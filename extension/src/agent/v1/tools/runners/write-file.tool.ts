import * as path from "path"
import { DiffViewProvider } from "../../../../integrations/editor/diff-view-provider"
import { ClaudeSayTool } from "../../../../shared/ExtensionMessage"
import { fileExistsAtPath } from "../../../../utils/path-helpers"
import { ToolResponse } from "../../types"
import { formatToolResponse, getCwd, getReadablePath } from "../../utils"
import { BaseAgentTool } from "../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../types"
import fs from "fs"
import { SequenceMatcher } from "difflib"

/**
 * Detects potential AI-generated code omissions in the given file content.
 * @param originalFileContent The original content of the file
 * @param newFileContent The new content of the file to check
 * @returns An object containing whether an omission was detected and details about the detection
 */
function detectCodeOmission(
	originalFileContent: string,
	newFileContent: string
): {
	hasOmission: boolean
	details: {
		line?: string
		keyword?: string
		lineNumber?: number
	}[]
} {
	const originalLines = originalFileContent.split("\n")
	const newLines = newFileContent.split("\n")
	const details: { line?: string; keyword?: string; lineNumber?: number }[] = []

	// Common phrases that indicate code omission
	const omissionKeywords = [
		"remain",
		"remains",
		"unchanged",
		"rest",
		"previous",
		"existing",
		"...",
		"placeholder implementation",
		"previous implementation",
		"rest of",
		"same as before",
		"as above",
		"similar to",
		"etc",
		"and so on",
	]

	// Comment patterns for various programming languages
	const commentPatterns = [
		/^\s*\/\//, // Single-line comment for most languages
		/^\s*#/, // Single-line comment for Python, Ruby, etc.
		/^\s*\/\*/, // Multi-line comment opening
		/^\s*\*/, // Multi-line comment continuation
		/^\s*\*\//, // Multi-line comment closing
		/^\s*{\s*\/\*/, // JSX comment opening
		/^\s*<!--/, // HTML comment opening
		/^\s*--/, // SQL comment
		/^\s*;/, // Assembly/Lisp comment
		/^\s*%/, // LaTeX/Matlab comment
		/^\s*\/\/\//, // Documentation comments
	]

	// Check each line in the new content
	newLines.forEach((line, lineNumber) => {
		// First check if it's a comment
		if (commentPatterns.some((pattern) => pattern.test(line))) {
			const normalizedLine = line.toLowerCase().trim()

			// Check for omission keywords in comments
			for (const keyword of omissionKeywords) {
				if (normalizedLine.includes(keyword.toLowerCase())) {
					// Verify this isn't in the original content
					if (!originalLines.some((origLine) => origLine.toLowerCase().trim() === normalizedLine)) {
						details.push({
							line: line,
							keyword: keyword,
							lineNumber: lineNumber + 1,
						})
					}
				}
			}
		}
	})

	// Check for inline omission indicators (like "...")
	newLines.forEach((line, lineNumber) => {
		const normalizedLine = line.toLowerCase().trim()
		if (normalizedLine.includes("...") && !originalLines.some((origLine) => origLine.includes("..."))) {
			details.push({
				line: line,
				keyword: "...",
				lineNumber: lineNumber + 1,
			})
		}
	})

	// Check for suspicious patterns that might indicate omitted code
	const suspiciousPatterns = [
		/\/\*\s*\.\.\.\s*\*\//i, // /* ... */
		/\/\/\s*\.\.\./i, // // ...
		/#\s*\.\.\./i, // # ...
		/<!--\s*\.\.\.\s*-->/i, // <!-- ... -->
		/\(\s*\.\.\.\s*\)/i, // (...)
	]

	newLines.forEach((line, lineNumber) => {
		for (const pattern of suspiciousPatterns) {
			if (pattern.test(line)) {
				details.push({
					line: line,
					keyword: "suspicious pattern",
					lineNumber: lineNumber + 1,
				})
			}
		}
	})

	return {
		hasOmission: details.length > 0,
		details: details,
	}
}

interface EditBlock {
	path: string
	searchContent: string
	replaceContent: string
}

export class WriteFileTool extends BaseAgentTool {
	protected params: AgentToolParams
	public diffViewProvider: DiffViewProvider
	private isProcessingFinalContent: boolean = false
	private lastUpdateTime: number = 0
	private readonly UPDATE_INTERVAL = 16
	private skipWriteAnimation: boolean = false
	private updateNumber: number = 0

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.diffViewProvider = new DiffViewProvider(getCwd(), this.koduDev)
		if (!!this.koduDev.getStateManager().skipWriteAnimation) {
			this.skipWriteAnimation = true
		}
	}

	override async execute() {
		const result = await this.processFileWrite()
		return result
	}

	public async handlePartialUpdateDiff(relPath: string, diff: string): Promise<void> {
		// this might happen because the diff view are not instant.
		if (this.isProcessingFinalContent) {
			this.logger("Skipping partial update because the tool is processing the final content.", "warn")
			return
		}
		// if the user has skipped the write animation, we don't need to show the diff view until we reach the final state
		if (this.skipWriteAnimation) {
			await this.params.updateAsk(
				"tool",
				{ tool: { tool: "write_to_file", diff, path: relPath, ts: this.ts, approvalState: "loading" } },
				this.ts
			)
			return
		}

		const currentTime = Date.now()
		// don't push too many updates to the diff view provider to avoid performance issues
		if (currentTime - this.lastUpdateTime < this.UPDATE_INTERVAL) {
			return
		}

		if (!this.diffViewProvider.isDiffViewOpen()) {
			try {
				// this actually opens the diff view but might take an extra few ms to be considered open requires interval check
				// it can take up to 300ms to open the diff view
				await this.diffViewProvider.open(relPath)
			} catch (e) {
				this.logger("Error opening diff view: " + e, "error")
				return
			}
		}
		const absolutePath = path.resolve(getCwd(), relPath)
		const fileExists = await this.checkFileExists(relPath)
		if (!fileExists) {
			throw new Error("File does not exist, but 'diff' parameter is provided")
		}

		// Read existing file content
		const originalContent = await fs.promises.readFile(absolutePath, "utf-8")

		try {
			// Parse and apply the edit blocks
			const editBlocks = this.parseDiffBlocks(diff, absolutePath)
			this.logger(`Parsed edit blocks: ${JSON.stringify(editBlocks)}`, "debug")
			const newContent = this.applyEditBlocksToFile(originalContent, editBlocks)
			await this.diffViewProvider.update(newContent, false)
			this.lastUpdateTime = currentTime
		} catch (e) {
			this.logger(`Not enough information to update the diff view: ${e}`, "warn")
		}
	}

	/**
	 *
	 * @param relPath - relative path of the file
	 * @param acculmatedContent - the accumulated content to be written to the file
	 * @returns
	 */
	public async handlePartialUpdate(relPath: string, acculmatedContent: string): Promise<void> {
		// this might happen because the diff view are not instant.
		if (this.isProcessingFinalContent) {
			this.logger("Skipping partial update because the tool is processing the final content.", "warn")
			return
		}
		this.updateNumber++
		// if the user has skipped the write animation, we don't need to show the diff view until we reach the final state
		if (this.skipWriteAnimation) {
			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "write_to_file",
						content: acculmatedContent,
						path: relPath,
						ts: this.ts,
						approvalState: "loading",
					},
				},
				this.ts
			)
			return
		}

		const currentTime = Date.now()
		// don't push too many updates to the diff view provider to avoid performance issues
		if (currentTime - this.lastUpdateTime < this.UPDATE_INTERVAL) {
			return
		}

		if (!this.diffViewProvider.isDiffViewOpen() && this.updateNumber === 1) {
			try {
				// this actually opens the diff view but might take an extra few ms to be considered open requires interval check
				// it can take up to 300ms to open the diff view
				await this.diffViewProvider.open(relPath)
			} catch (e) {
				this.logger("Error opening diff view: " + e, "error")
				return
			}
		}
		await this.diffViewProvider.update(acculmatedContent, false)
		this.lastUpdateTime = currentTime
	}

	private parseDiffBlocks(diffContent: string, path: string): EditBlock[] {
		const editBlocks: EditBlock[] = []
		const lines = diffContent.split("\n")
		let i = 0

		while (i < lines.length) {
			if (lines[i].startsWith("SEARCH")) {
				const searchLines: string[] = []
				i++
				while (i < lines.length && lines[i] !== "=======") {
					searchLines.push(lines[i])
					i++
				}

				if (i < lines.length && lines[i] === "=======") {
					i++
				}

				const replaceLines: string[] = []
				if (i < lines.length && lines[i] === "REPLACE") {
					i++
				}
				while (i < lines.length && lines[i] !== "SEARCH") {
					replaceLines.push(lines[i])
					i++
				}

				editBlocks.push({
					path: path, // You might need to enhance this for multi-file scenarios
					searchContent: searchLines.join("\n").trimEnd(),
					replaceContent: replaceLines.join("\n").trimEnd(),
				})
			} else {
				i++
			}
		}
		return editBlocks
	}

	private applyEditBlocksToFile(content: string, editBlocks: EditBlock[]): string {
		let newContent = content
		for (const block of editBlocks) {
			const searchPattern = block.searchContent.trim()
			const replacePattern = block.replaceContent

			const index = newContent.indexOf(searchPattern)
			if (index !== -1) {
				newContent =
					newContent.substring(0, index) + replacePattern + newContent.substring(index + searchPattern.length)
			} else {
				// Try to find similar lines
				const similarLines = this.findSimilarLines(searchPattern, newContent)
				if (similarLines) {
					const similarIndex = newContent.indexOf(similarLines)
					newContent =
						newContent.substring(0, similarIndex) +
						replacePattern +
						newContent.substring(similarIndex + similarLines.length)
				} else {
					console.error(`Failed to find match for SEARCH block: ${searchPattern}`)
					throw new Error(`SEARCH block failed to match: ${searchPattern}`)
				}
			}
		}
		return newContent
	}

	private async processFileWrite() {
		try {
			const { path: relPath, content, diff } = this.params.input

			if (!relPath) {
				throw new Error("Missing required parameter 'path'")
			}

			// Switch to final state ASAP
			this.isProcessingFinalContent = true

			const absolutePath = path.resolve(getCwd(), relPath)
			const fileExists = await this.checkFileExists(relPath)

			let newContent: string

			if (fileExists) {
				if (!diff) {
					throw new Error("File exists, but 'diff' parameter is missing")
				}

				// Read existing file content
				const originalContent = await fs.promises.readFile(absolutePath, "utf-8")

				// Parse and apply the edit blocks
				const editBlocks = this.parseDiffBlocks(diff, absolutePath)
				newContent = this.applyEditBlocksToFile(originalContent, editBlocks)
			} else {
				if (!content) {
					throw new Error("File does not exist, but 'content' parameter is missing")
				}
				newContent = content
			}

			// Show changes in diff view
			await this.showChangesInDiffView(relPath, newContent)

			const { response, text, images } = await this.params.ask(
				"tool",
				{
					tool: {
						tool: "write_to_file",
						content: newContent,
						approvalState: "pending",
						path: relPath,
						ts: this.ts,
					},
				},
				this.ts
			)

			if (response !== "yesButtonTapped") {
				await this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "write_to_file",
							content: newContent,
							approvalState: "rejected",
							path: relPath,
							ts: this.ts,
							userFeedback: text,
						},
					},
					this.ts
				)
				await this.diffViewProvider.revertChanges()

				if (response === "noButtonTapped") {
					// return formatToolResponse("Write operation cancelled by user.")
					// return this.toolResponse("rejected", "Write operation cancelled by user.")
					return this.toolResponse("rejected", "Write operation cancelled by user.")
				}
				// If not a yes or no, the user provided feedback (wrote in the input)
				await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
				// return formatToolResponse(
				// 	`The user denied the write operation and provided the following feedback: ${text}`
				// )
				return this.toolResponse("feedback", text ?? "The user denied this operation.", images)
			}

			// Save changes and handle user edits
			const { userEdits, finalContent } = await this.diffViewProvider.saveChanges()
			this.koduDev.getStateManager().addErrorPath(relPath)

			// Final approval state
			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "write_to_file",
						content: newContent,
						approvalState: "approved",
						path: relPath,
						ts: this.ts,
					},
				},
				this.ts
			)

			if (userEdits) {
				await this.params.say(
					"user_feedback_diff",
					JSON.stringify({
						tool: fileExists ? "editedExistingFile" : "newFileCreated",
						path: getReadablePath(getCwd(), relPath),
						diff: userEdits,
					} as ClaudeSayTool)
				)
				return this.toolResponse(
					"success",
					`The user made the following updates to your content:\n\n${userEdits}\n\nThe updated content has been successfully saved to ${relPath.toPosix()}. (Note: you don't need to re-write the file with these changes.)`
				)
			}

			let toolMsg = `The content was successfully saved to ${relPath.toPosix()}. Do not read the file again unless you forgot the content.`
			if (detectCodeOmission(content || "", finalContent)) {
				console.log(`Truncated content detected in ${relPath} at ${this.ts}`)
				toolMsg = `The content was successfully saved to ${relPath.toPosix()}, but it appears that some code may have been omitted. In caee you didn't write the entire content and included some placeholders or omitted critical parts, please try again with the full output of the code without any omissions / truncations anything similar to "remain", "remains", "unchanged", "rest", "previous", "existing", "..." should be avoided.
		  You dont need to read the file again as the content has been updated to your previous tool request content.
		  `
			}

			return this.toolResponse("success", toolMsg)
		} catch (error) {
			console.error("Error in processFileWrite:", error)
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "write_to_file",
						content: this.params.input.content ?? "",
						approvalState: "error",
						path: this.params.input.path ?? "",
						ts: this.ts,
						error: `Failed to write to file`,
					},
				},
				this.ts
			)

			return this.toolResponse(
				"error",
				`Write to File Error With:${error instanceof Error ? error.message : String(error)}`
			)
		} finally {
			this.isProcessingFinalContent = false
			this.diffViewProvider.isEditing = false
		}
	}

	private async checkFileExists(relPath: string): Promise<boolean> {
		const absolutePath = path.resolve(getCwd(), relPath)
		return await fileExistsAtPath(absolutePath)
	}

	private async showChangesInDiffView(relPath: string, content: string): Promise<void> {
		content = this.preprocessContent(content)
		if (!this.diffViewProvider.isDiffViewOpen()) {
			await this.diffViewProvider.open(relPath, true)
		}

		await this.diffViewProvider.update(content, true)
	}

	private preprocessContent(content: string): string {
		content = content.trim()
		if (content.startsWith("```")) {
			content = content.split("\n").slice(1).join("\n").trim()
		}
		if (content.endsWith("```")) {
			content = content.split("\n").slice(0, -1).join("\n").trim()
		}
		return content.replace(/>/g, ">").replace(/</g, "<").replace(/"/g, '"')
	}

	private findSimilarLines(searchContent: string, content: string, threshold: number = 0.6): string {
		const searchLines = searchContent.split("\n")
		const contentLines = content.split("\n")

		let bestRatio = 0
		let bestMatch: string[] = []

		for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
			const chunk = contentLines.slice(i, i + searchLines.length)
			const matcher = new SequenceMatcher(null, searchLines.join("\n"), chunk.join("\n"))
			const similarity = matcher.ratio()
			if (similarity > bestRatio) {
				bestRatio = similarity
				bestMatch = chunk
			}
		}

		return bestRatio >= threshold ? bestMatch.join("\n") : ""
	}
}
