import * as path from "path"
import { DiffViewProvider } from "../../../../integrations/editor/diff-view-provider"
import { ClaudeSayTool } from "../../../../shared/ExtensionMessage"
import { fileExistsAtPath } from "../../../../utils/path-helpers"
import { ToolResponse } from "../../types"
import { formatToolResponse, getCwd, getReadablePath } from "../../utils"
import { BaseAgentTool } from "../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../types"

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

export class WriteFileTool extends BaseAgentTool {
	protected params: AgentToolParams
	public diffViewProvider: DiffViewProvider
	private isProcessingFinalContent: boolean = false
	private lastUpdateTime: number = 0
	private readonly UPDATE_INTERVAL = 8
	private skipWriteAnimation: boolean = false

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.diffViewProvider = new DiffViewProvider(getCwd(), this.koduDev, this.UPDATE_INTERVAL)
		if (!!this.koduDev.getStateManager().skipWriteAnimation) {
			this.skipWriteAnimation = true
		}
	}

	override async execute() {
		const result = await this.processFileWrite()
		return result
	}

	public async handlePartialUpdate(relPath: string, content: string): Promise<void> {
		// this might happen because the diff view are not instant.
		if (this.isProcessingFinalContent) {
			this.logger("Skipping partial update because the tool is processing the final content.", "warn")
			return
		}
		// if the user has skipped the write animation, we don't need to show the diff view until we reach the final state
		if (this.skipWriteAnimation) {
			await this.params.updateAsk(
				"tool",
				{ tool: { tool: "write_to_file", content, path: relPath, ts: this.ts, approvalState: "loading" } },
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
		await this.diffViewProvider.update(content, false)
		this.lastUpdateTime = currentTime
	}

	private async processFileWrite() {
		try {
			const { path: relPath, content } = this.params.input

			if (!relPath || !content) {
				throw new Error("Missing required parameters 'path' or 'content'")
			}
			// switch to final state asap
			this.isProcessingFinalContent = true

			// Show changes in diff view
			await this.showChangesInDiffView(relPath, content)

			const { response, text, images } = await this.params.ask(
				"tool",
				{
					tool: {
						tool: "write_to_file",
						content: content,
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
							content: content,
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
			const fileExists = await this.checkFileExists(relPath)
			const { userEdits, finalContent } = await this.diffViewProvider.saveChanges()
			this.koduDev.getStateManager().addErrorPath(relPath)

			// Final approval state
			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "write_to_file",
						content: content,
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
				// return formatToolResponse(
				// 	`The user made the following updates to your content:\n\n${userEdits}\n\nThe updated content has been successfully saved to ${relPath.toPosix()}. (Note: you don't need to re-write the file with these changes.)`
				// )
				return this.toolResponse(
					"success",
					`The user made the following updates to your content:\n\n${userEdits}\n\nThe updated content has been successfully saved to ${relPath.toPosix()}. (Note: you don't need to re-write the file with these changes.)`
				)
			}

			// return formatToolResponse(
			// 	`The content was successfully saved to ${relPath.toPosix()}. Do not read the file again unless you forgot the content.`
			// )

			let toolMsg = `The content was successfully saved to ${relPath.toPosix()}. Do not read the file again unless you forgot the content.`
			if (detectCodeOmission(content, finalContent)) {
				console.log(`Truncated content detected in ${relPath} at ${this.ts}`)
				toolMsg = `The content was successfully saved to ${relPath.toPosix()}, but it appears that some code may have been omitted. In caee you didn't write the entire content and included some placeholders or omitted critical parts, please try again with the full output of the code without any omissions / truncations anything similar to "remain", "remains", "unchanged", "rest", "previous", "existing", "..." should be avoided.`
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

			// return formatToolResponse(
			// 	`Write to File Error With:${error instanceof Error ? error.message : String(error)}`
			// )
			return this.toolResponse(
				"error",
				`Write to File Error With:${error instanceof Error ? error.message : String(error)}`
			)
		} finally {
			this.isProcessingFinalContent = false
			this.diffViewProvider.isEditing = false
		}
	}

	private async showChangesInDiffView(relPath: string, content: string): Promise<void> {
		content = this.preprocessContent(content)

		if (!this.diffViewProvider.isDiffViewOpen()) {
			await this.diffViewProvider.open(relPath)
		}

		await this.diffViewProvider.update(content, true)
	}

	private async checkFileExists(relPath: string): Promise<boolean> {
		const absolutePath = path.resolve(getCwd(), relPath)
		return await fileExistsAtPath(absolutePath)
	}

	override async abortToolExecution(): Promise<void> {
		console.log("Aborting WriteFileTool execution")
		await this.diffViewProvider.revertChanges()
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
}
