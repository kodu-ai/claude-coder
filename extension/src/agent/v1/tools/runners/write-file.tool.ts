import { serializeError } from "serialize-error"
import * as path from "path"
import { ClaudeAsk, ClaudeSayTool } from "../../../../shared/ExtensionMessage"
import { ToolResponse } from "../../types"
import { formatToolResponse, getCwd, getReadablePath } from "../../utils"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"
import { createPrettyPatch, DiffViewProvider } from "../../../../integrations/editor/diff-view-provider"
import { fileExistsAtPath } from "../../../../utils/path-helpers"
import delay from "delay"

export class WriteFileTool extends BaseAgentTool {
	protected params: AgentToolParams
	private readonly TIMEOUT = 180_000 // 3 min timeout
	private fileExists: boolean | undefined
	private executionPromise: Promise<ToolResponse> | null = null
	public diffViewProvider: DiffViewProvider

	private resolveExecution: ((response: ToolResponse) => void) | null = null
	private isProcessingFinalContent: boolean = false
	private askPromise: Promise<{ response: string; text?: string; images?: string[] }> | null = null

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.diffViewProvider = new DiffViewProvider(getCwd(), this.koduDev)
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

			// Handle the ask at the beginning of the execution
			this.askPromise = this.params.ask(
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

			if (!this.params.isFinal) {
				await this.handlePartialContent(relPath, content)
			} else {
				await this.handlePartialContent(relPath, content)
				this.isProcessingFinalContent = true
			}

			// Wait for the ask promise to be resolved
			const { response, text, images } = await this.askPromise

			if (response !== "yesButtonTapped") {
				await this.diffViewProvider.revertChanges()
				if (response === "noButtonTapped") {
					await this.resolveExecutionWithResult(formatToolResponse("Write operation cancelled by user."))
					return
				}
				await this.resolveExecutionWithResult(
					formatToolResponse(text ?? "Write operation cancelled by user.", images)
				)
				return
			}
			await this.handleFinalContent(relPath, content)

			// If we reach here, it means the changes were approved
			await this.resolveExecutionWithResult(formatToolResponse("File write operation completed successfully"))
			return
		} catch (error) {
			console.error("Error in processFileWrite:", error)
			await this.resolveExecutionWithResult(formatToolResponse(`Error: ${error.message}`))
		} finally {
			this.isProcessingFinalContent = false
		}
	}

	public async handlePartialContent(relPath: string, newContent: string): Promise<void> {
		if (this.isProcessingFinalContent && this.fileExists !== undefined) {
			console.log("Skipping partial update as final content is being processed")
			return
		}

		console.log("handlePartialContent started")
		if (this.fileExists === undefined) {
			const result = await this.checkFileExists(relPath)
			this.diffViewProvider.editType = result ? "modify" : "create"
			this.fileExists = result
		}
		newContent = this.preprocessContent(newContent)

		if (!this.diffViewProvider.isEditing) {
			try {
				await this.diffViewProvider.open(relPath)
			} catch (e) {
				console.error("Error opening file: ", e)
			}
		}

		await this.diffViewProvider.update(newContent, false)
		await delay(50) // Wait for diff view to update
		console.log("handlePartialContent completed")
	}

	public async handleFinalContent(relPath: string, newContent: string): Promise<void> {
		console.log("handleFinalContent started")
		const fileExists = await this.checkFileExists(relPath)
		newContent = this.preprocessContent(newContent)

		await this.diffViewProvider.update(newContent, true)
		await delay(300) // Wait for diff view to update

		const { newProblemsMessage, userEdits } = await this.diffViewProvider.saveChanges()
		this.params.ask(
			"tool",
			{
				tool: {
					tool: "write_to_file",
					content: newContent,
					approvalState: "approved",
					ts: this.ts,
					path: relPath,
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
			console.log(`User edits detected: ${userEdits}`)
		}
		console.log("handleFinalContent completed")
	}

	private async resolveExecutionWithResult(result: ToolResponse) {
		console.log("resolveExecutionWithResult called")
		if (this.resolveExecution) {
			this.diffViewProvider.isEditing = false
			await this.diffViewProvider.reset()
			await delay(50)

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
		this.diffViewProvider.editType = fileExists ? "modify" : "create"
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
}
