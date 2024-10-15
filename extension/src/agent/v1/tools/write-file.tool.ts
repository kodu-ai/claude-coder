import { serializeError } from "serialize-error"
import * as path from "path"
import { ClaudeAsk, ClaudeSayTool } from "../../../shared/ExtensionMessage"
import { ToolResponse } from "../types"
import { formatToolResponse, getCwd, getReadablePath } from "../utils"
import { AgentToolOptions, AgentToolParams } from "./types"
import { BaseAgentTool } from "./base-agent.tool"
import { createPrettyPatch } from "../../../integrations/editor/diff-view-provider"
import { fileExistsAtPath } from "../../../utils/path-helpers"
import delay from "delay"

export class WriteFileTool extends BaseAgentTool {
	protected params: AgentToolParams
	private readonly TIMEOUT = 180_000 // 3 min timeout
	private fileExists: boolean | undefined
	private executionPromise: Promise<ToolResponse> | null = null
	private resolveExecution: ((response: ToolResponse) => void) | null = null

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	override async execute(): Promise<ToolResponse> {
		console.log("WriteFileTool execute method called")

		if (this.executionPromise) {
			console.log("Returning existing execution promise")
			return this.executionPromise
		}

		this.executionPromise = new Promise(async (resolve) => {
			this.resolveExecution = resolve
			await this.processFileWrite()
		})

		return this.executionPromise
	}

	private async processFileWrite(): Promise<void> {
		console.log("processFileWrite started")
		try {
			const { path: relPath, content } = this.params.input

			if (!relPath || !content) {
				throw new Error("Missing required parameters 'path' or 'content'")
			}

			await this.handlePartialContent(relPath, content)
			await this.handleFinalContent(relPath, content)
			// Make sure to resolve here if everything succeeds
			await this.resolveExecutionWithResult(formatToolResponse("File write operation completed successfully"))
		} catch (error) {
			console.error("Error in processFileWrite:", error)
			await this.resolveExecutionWithResult(formatToolResponse(`Error: ${error.message}`))
		}
	}

	public async handlePartialContent(relPath: string, newContent: string): Promise<void> {
		console.log("handlePartialContent started")
		if (this.fileExists === undefined) {
			const result = await this.checkFileExists(relPath)
			this.koduDev.diffViewProvider.editType = result ? "modify" : "create"
			this.fileExists = result
		}
		newContent = this.preprocessContent(newContent)

		if (!this.koduDev.diffViewProvider.isEditing) {
			try {
				await this.koduDev.diffViewProvider.open(relPath)
			} catch (e) {
				console.error("Error opening file: ", e)
			}
		}

		await this.koduDev.diffViewProvider.update(newContent, false)
		console.log("handlePartialContent completed")
	}

	public async handleFinalContent(relPath: string, newContent: string): Promise<void> {
		console.log("handleFinalContent started")
		const fileExists = await this.checkFileExists(relPath)
		newContent = this.preprocessContent(newContent)

		await this.koduDev.diffViewProvider.update(newContent, true)
		// await delay(300) // Wait for diff view to update

		const sharedMessageProps: ClaudeSayTool = {
			tool: this.koduDev.diffViewProvider.editType === "modify" ? "editedExistingFile" : "newFileCreated",
			path: getReadablePath(getCwd(), relPath),
		}

		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			content: fileExists ? undefined : newContent,
			diff: fileExists
				? createPrettyPatch(relPath, this.koduDev.diffViewProvider.originalContent, newContent)
				: undefined,
		})
		const { response, text, images } = await this.params.ask("tool", completeMessage)

		if (response !== "yesButtonTapped") {
			await this.koduDev.diffViewProvider.revertChanges()
			if (response === "noButtonTapped") {
				await this.resolveExecutionWithResult(formatToolResponse("Write operation cancelled by user."))
				return
			}
			await this.resolveExecutionWithResult(
				formatToolResponse(text ?? "Write operation cancelled by user.", images)
			)
			return
		}

		const { newProblemsMessage, userEdits } = await this.koduDev.diffViewProvider.saveChanges()

		if (userEdits) {
			await this.params.say(
				"user_feedback_diff",
				JSON.stringify({
					tool: fileExists ? "editedExistingFile" : "newFileCreated",
					path: getReadablePath(getCwd(), relPath),
					diff: userEdits,
				} as ClaudeSayTool)
			)
			await this.resolveExecutionWithResult(
				formatToolResponse(
					`The user made the following updates to your content:\n\n${userEdits}\n\nThe updated content has been successfully saved to ${relPath}. (Note this does not mean you need to re-write the file with the user's changes, as they have already been applied to the file.)${newProblemsMessage}`
				)
			)
		} else {
			await this.resolveExecutionWithResult(
				formatToolResponse(`The content was successfully saved to ${relPath}.${newProblemsMessage}`)
			)
		}
		console.log("handleFinalContent completed")
	}

	private async resolveExecutionWithResult(result: ToolResponse) {
		console.log("resolveExecutionWithResult called")
		if (this.resolveExecution) {
			this.koduDev.diffViewProvider.isEditing = false
			await this.koduDev.diffViewProvider.reset()

			this.resolveExecution(result)
			this.executionPromise = null
			this.resolveExecution = null
		} else {
			console.warn("resolveExecution is null")
		}
		console.log("resolveExecutionWithResult completed")
	}

	private async checkFileExists(relPath: string): Promise<boolean> {
		const absolutePath = path.resolve(getCwd(), relPath)
		const fileExists = await fileExistsAtPath(absolutePath)
		this.koduDev.diffViewProvider.editType = fileExists ? "modify" : "create"
		return fileExists
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

	private async onBadInputReceived(): Promise<ToolResponse> {
		const { input, say } = this.params
		const { path: relPath } = input

		if (relPath === undefined) {
			await say(
				"error",
				"Claude tried to use write_to_file without value for required parameter 'path'. Retrying..."
			)

			return formatToolResponse(`Error: Missing value for required parameter 'path'. Please retry with complete response.
            A good example of a writeToFile tool call is:
            {
                "tool": "write_to_file",
                "path": "path/to/file.txt",
                "content": "new content"
            }
            Please try again with the correct path and content, you are not allowed to write files without a path.
            `)
		}

		await say(
			"error",
			`Claude tried to use write_to_file for '${relPath}' without value for required parameter 'content'. This is likely due to output token limits. Retrying...`
		)

		return formatToolResponse(`Error: Missing value for required parameter 'content'. Please retry with complete response.
            A good example of a writeToFile tool call is:
            {
                "tool": "write_to_file",
                "path": "path/to/file.txt",
                "content": "new content"
            }
            Please try again with the correct path and content, you are not allowed to write files without a path.
            `)
	}
}
