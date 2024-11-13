import * as path from "path"
import { applyPatch, parsePatch } from "diff"
import { DiffViewProvider } from "../../../../integrations/editor/diff-view-provider"
import { ClaudeSayTool } from "../../../../shared/ExtensionMessage"
import { fileExistsAtPath } from "../../../../utils/path-helpers"
import { ToolResponse } from "../../types"
import { formatToolResponse, getCwd, getReadablePath } from "../../utils"
import { BaseAgentTool } from "../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../types"
import fs from "fs"

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

interface DiffLine {
	type: 'context' | 'addition' | 'deletion';
	content: string;
  }
  
  interface DiffHunk {
	lines: DiffLine[];
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

	private applyDiff(originalContent: string, diff: string): string {
		const originalLines = originalContent.split('\n');
		const hunks = this.parseUnifiedDiff(diff);
	  
		let resultLines = originalLines.slice(); // Create a copy to modify
		let cumulativeOffset = 0; // Keeps track of the offset between originalLines and resultLines
	  
		for (const hunk of hunks) {
		  // Extract matching sequence from the hunk (context and deletion lines up to the first addition)
		  const matchingSequence = [];
		  let foundAddition = false;
		  for (const hunkLine of hunk.lines) {
			if (hunkLine.type === 'addition') {
			  foundAddition = true;
			  break; // Stop at the first addition
			} else if (hunkLine.type === 'context' || hunkLine.type === 'deletion') {
			  matchingSequence.push(hunkLine.content);
			}
		  }
	  
		  // Find the position in originalLines
		  const positionInOriginal = this.findBestMatchPosition(
			originalLines,
			matchingSequence,
			0 // Always search from the beginning in originalLines
		  );
	  
		  if (positionInOriginal !== -1) {
			// Adjust position for resultLines
			const positionInResult = positionInOriginal + cumulativeOffset;
	  
			// Apply the hunk at the adjusted position
			const hunkResult = this.applyHunk(
			  resultLines.slice(positionInResult),
			  hunk.lines // Use all lines in the hunk for applying changes
			);
	  
			// Replace the original lines with the modified lines
			resultLines.splice(
			  positionInResult,
			  hunkResult.originalLineCount,
			  ...hunkResult.modifiedLines
			);
	  
			// Update cumulativeOffset based on changes in line count
			cumulativeOffset += hunkResult.modifiedLines.length - hunkResult.originalLineCount;
		  } else {
			console.error('Failed to apply hunk: context not found in original content.');
			throw new Error('Failed to apply hunk: context not found.');
		  }
		}
	  
		return resultLines.join('\n');
	  }
	  
	  
	  
	  private findBestMatchPosition(
		lines: string[],
		matchingSequence: string[],
		currentOffset: number,
		maxSearchDistance: number = 500 // Optional: limit search range for performance
	  ): number {
		const totalLines = lines.length;
		const sequenceLength = matchingSequence.length;
		const searchLimit = Math.min(currentOffset + maxSearchDistance, totalLines - sequenceLength);
		let bestMatchIndex = -1;
		let bestMatchScore = -1;
	  
		for (let i = currentOffset; i <= searchLimit; i++) {
		  let score = 0;
		  for (let j = 0; j < sequenceLength; j++) {
			if (lines[i + j] === matchingSequence[j]) {
			  score++;
			}
		  }
		  if (score > bestMatchScore) {
			bestMatchScore = score;
			bestMatchIndex = i;
		  }
	  
		  // Early exit if perfect match is found
		  if (score === sequenceLength) {
			return i;
		  }
		}
	  
		// Define a threshold for acceptable matches (e.g., 90% of matching sequence)
		const threshold = Math.floor(sequenceLength * 0.9);
		if (bestMatchScore >= threshold) {
		  return bestMatchIndex;
		}
	  
		return -1; // No acceptable match found
	  }

	  
	  private applyHunk(
		lines: string[],
		hunkLines: DiffLine[]
	  ): { modifiedLines: string[]; originalLineCount: number } {
		const modifiedLines: string[] = [];
		let originalLineCount = 0;
		let index = 0;
	  
		for (const hunkLine of hunkLines) {
		  if (hunkLine.type === 'context' || hunkLine.type === 'deletion') {
			// These lines should match the original lines
			if (lines[index] !== hunkLine.content) {
			  throw new Error(
				`Hunk line does not match original content at line ${index + 1}: expected "${hunkLine.content}", found "${lines[index]}"`
			  );
			}
			if (hunkLine.type === 'context') {
			  // Context lines are kept
			  modifiedLines.push(hunkLine.content);
			}
			// Move to the next line in the original content
			index++;
			originalLineCount++;
		  } else if (hunkLine.type === 'addition') {
			// Added lines are inserted into the modified content
			modifiedLines.push(hunkLine.content);
		  }
		}
	  
		return { modifiedLines, originalLineCount };
	  }
	private parseUnifiedDiff(diff: string): DiffHunk[] {
		const diffLines = diff.split('\n');
		const hunks: DiffHunk[] = [];
		let i = 0;
	  
		while (i < diffLines.length) {
		  const line = diffLines[i];
	  
		  if (line.startsWith('@@')) {
			i++; // Move to the next line after the hunk header
			const hunkLines: DiffLine[] = [];
	  
			while (
			  i < diffLines.length &&
			  !diffLines[i].startsWith('@@') &&
			  !diffLines[i].startsWith('---') &&
			  !diffLines[i].startsWith('+++')
			) {
			  const diffLine = diffLines[i];
			  if (diffLine.startsWith(' ')) {
				hunkLines.push({ type: 'context', content: diffLine.substring(1) });
			  } else if (diffLine.startsWith('+')) {
				hunkLines.push({ type: 'addition', content: diffLine.substring(1) });
			  } else if (diffLine.startsWith('-')) {
				hunkLines.push({ type: 'deletion', content: diffLine.substring(1) });
			  }
			  i++;
			}
	  
			hunks.push({ lines: hunkLines });
		  } else {
			i++;
		  }
		}
	  
		return hunks;
	  }
	  

	
	
	private async processFileWrite() {
		try {
			const { path: relPath, content, udiff } = this.params.input

			if (!relPath) {
				throw new Error("Missing required parameter 'path'")
			}

			// Switch to final state ASAP
			this.isProcessingFinalContent = true

			const absolutePath = path.resolve(getCwd(), relPath)
			const fileExists = await this.checkFileExists(relPath)

			let newContent: string

			if (fileExists) {
				if (!udiff) {
					throw new Error("File exists, but 'udiff' parameter is missing")
				}

				// Read existing file content
				const originalContent = await fs.promises.readFile(absolutePath, "utf-8")
				// const fixedUdiff = await this.sescondPass(originalContent)
				// Apply the diff
				const patchedContentTest = this.applyDiff(originalContent, udiff)

				if (patchedContentTest === null) {
					throw new Error("Failed to apply the diff")
				}

				newContent = patchedContentTest
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

	private async sescondPass(originalContent: string) {
		// run a second pass of the udiff and then create a finalized udiff with the perfect content.
		return await this.koduDev
			.getApiManager()
			.fixUdiff(this.paramsInput.udiff!, originalContent, this.paramsInput.path!)
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
