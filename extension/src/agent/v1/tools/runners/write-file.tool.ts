import * as path from "path"
import { ClaudeSayTool } from "../../../../shared/ExtensionMessage"
import { ToolResponse } from "../../types"
import { formatToolResponse, getCwd, getReadablePath } from "../../utils"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"
import { DiffViewProvider } from "../../../../integrations/editor/diff-view-provider"
import { fileExistsAtPath } from "../../../../utils/path-helpers"
import delay from "delay"
import pWaitFor from "p-wait-for"

export class WriteFileTool extends BaseAgentTool {
	protected params: AgentToolParams
	public diffViewProvider: DiffViewProvider
	private isProcessingFinalContent: boolean = false
	private lastUpdateLength: number = 0
	private lastUpdateTime: number = 0
	private readonly UPDATE_INTERVAL = 33 // Approximately 60 FPS

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.diffViewProvider = new DiffViewProvider(getCwd(), this.koduDev, this.UPDATE_INTERVAL)
	}

	override async execute(): Promise<ToolResponse> {
		// Perform initial ask without awaiting
		this.params.ask(
			"tool",
			{
				tool: {
					tool: "write_to_file",
					content: this.params.input.content ?? "",
					approvalState: "loading",
					path: this.params.input.path ?? "",
					ts: this.ts,
				},
			},
			this.ts
		)
		await pWaitFor(() => this.isFinal, { interval: 20 })

		const result = await this.processFileWrite()

		return result
	}

	private async processFileWrite(): Promise<ToolResponse> {
		try {
			const { path: relPath, content } = this.params.input

			if (!relPath || !content) {
				throw new Error("Missing required parameters 'path' or 'content'")
			}

			// Handle partial content if not final
			if (!this.params.isFinal) {
				await this.handlePartialContent(relPath, content)
			} else {
				await this.handlePartialContent(relPath, content)
				await this.handleFinalContentForConfirmation(relPath, content)
				this.isProcessingFinalContent = true
			}

			// Ask for user approval and await response

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
			console.log("User responded at:", Date.now())

			if (response !== "yesButtonTapped") {
				// Revert changes if user declines
				await this.diffViewProvider.revertChanges()
				this.params.ask(
					"tool",
					{
						tool: {
							tool: "write_to_file",
							content: this.params.input.content ?? "No content provided",
							approvalState: "rejected",
							path: relPath,
							ts: this.ts,
						},
					},
					this.ts
				)
				if (response === "noButtonTapped") {
					return formatToolResponse("Write operation cancelled by user.")
				}
				return formatToolResponse(text ?? "Write operation cancelled by user.", images)
			}

			// Proceed with final content handling
			const fileContent = await this.handleFinalContent(relPath, content)

			// Notify approval
			this.params.ask(
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

			// Return success message
			return formatToolResponse(fileContent)
		} catch (error) {
			console.error("Error in processFileWrite:", error)
			return formatToolResponse(`Error: ${error.message}`)
		} finally {
			this.isProcessingFinalContent = false
			this.diffViewProvider.isEditing = false
		}
	}

	public async handlePartialContent(relPath: string, newContent: string): Promise<void> {
		if (this.isProcessingFinalContent) {
			console.log("Skipping partial update as final content is being processed")
			return
		}

		const currentTime = Date.now()

		if (!this.diffViewProvider.isEditing) {
			try {
				await this.diffViewProvider.open(relPath)
				this.lastUpdateLength = 0
				this.lastUpdateTime = currentTime
			} catch (e) {
				console.error("Error opening file: ", e)
			}
		}

		// Check if enough time has passed since the last update
		if (currentTime - this.lastUpdateTime < this.UPDATE_INTERVAL) {
			return
		}

		// Perform the update
		await this.diffViewProvider.update(newContent, false)
		this.lastUpdateTime = currentTime
	}

	private async handleFinalContentForConfirmation(relPath: string, newContent: string): Promise<void> {
		newContent = this.preprocessContent(newContent)
		await this.diffViewProvider.update(newContent, true)
	}

	public async handleFinalContent(relPath: string, newContent: string): Promise<string> {
		const fileExists = await this.checkFileExists(relPath)
		const { userEdits, newProblemsMessage } = await this.diffViewProvider.saveChanges()
		await delay(300)
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

		let response: string
		if (userEdits) {
			response = `The user made the following updates to your content:\n\n${userEdits}\n\nThe updated content, which includes both your original modifications and the user's additional edits, has been successfully saved to ${relPath.toPosix()}. (Note this does not mean you need to re-write the file with the user's changes, as they have already been applied to the file.)${newProblemsMessage}`
		} else {
			response = `The content was successfully saved to ${relPath.toPosix()}.
			Do not read the file again unless you forgot the file content, (the current content is the one you sent in <content>...</content>).
			If you find yourself stuck e.x writing to the file again and again, take a moment to zoom out and think about the problem you are trying to solve, and then attack it from a different angle.
			${
				newProblemsMessage === ""
					? `No new problems were detected after saving the file. linting passed. let's move on to the next step.`
					: `${newProblemsMessage} we found the following linting issues in the file, if you see any mission critical issues that are ABSOLUTELY necessary to fix, please let fix them before moving on, if not we can move on to the next step and fix them if it becomes necessary or becomes a blocker.`
			}`
		}

		return response
	}

	private async checkFileExists(relPath: string): Promise<boolean> {
		const absolutePath = path.resolve(getCwd(), relPath)
		const fileExists = await fileExistsAtPath(absolutePath)
		return fileExists
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
