import * as path from "path"
import { DiffViewProvider } from "../../../../../integrations/editor/diff-view-provider"
import { ClaudeSayTool } from "../../../../../shared/ExtensionMessage"
import { getCwd, getReadablePath } from "../../../utils"
import { BaseAgentTool } from "../../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../../types"
import fs from "fs"
import { detectCodeOmission } from "./detect-code-omission"
import { parseDiffBlocks, applyEditBlocksToFile, checkFileExists, preprocessContent } from "./utils"

export class FileEditorTool extends BaseAgentTool {
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
		const fileExists = await checkFileExists(relPath)
		if (!fileExists) {
			throw new Error("File does not exist, but 'diff' parameter is provided")
		}

		// Read existing file content
		const originalContent = await fs.promises.readFile(absolutePath, "utf-8")

		try {
			// Parse and apply the edit blocks
			const editBlocks = parseDiffBlocks(diff, absolutePath)
			this.logger(`Parsed edit blocks: ${JSON.stringify(editBlocks)}`, "debug")
			const newContent = await applyEditBlocksToFile(originalContent, editBlocks)
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

	private async processFileWrite() {
		try {
			const { path: relPath, kodu_content: content, kodu_diff: diff } = this.params.input
			if (!relPath) {
				throw new Error("Missing required parameter 'path'")
			}
			this.logger(`Writing to file: ${relPath}`, "info")

			// Switch to final state ASAP
			this.isProcessingFinalContent = true

			const absolutePath = path.resolve(getCwd(), relPath)
			const fileExists = await checkFileExists(relPath)

			let newContent: string

			if (fileExists && diff) {
				this.logger(`File exists and diff is provided.`, "debug")
				// Read existing file content
				const originalContent = await fs.promises.readFile(absolutePath, "utf-8")

				// Parse and apply the edit blocks
				const editBlocks = parseDiffBlocks(diff, absolutePath)
				newContent = await applyEditBlocksToFile(originalContent, editBlocks)
			} else {
				this.logger(`File does not exist or diff is not provided.`, "debug")
				if (!content) {
					throw new Error("File does not exist, but 'kodu_content' parameter is missing")
				}
				newContent = content
			}

			this.logger(`New content: ${newContent}`, "debug")
			// Show changes in diff view
			await this.showChangesInDiffView(relPath, newContent)
			this.logger(`Changes shown in diff view`, "debug")

			this.logger(`Asking for approval to write to file: ${relPath}`, "info")
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

			this.logger(`User approved to write to file: ${relPath}`, "info")

			this.logger(`Saving changes to file: ${relPath}`, "info")
			// Save changes and handle user edits
			const { userEdits, finalContent } = await this.diffViewProvider.saveChanges()
			this.logger(`Changes saved to file: ${relPath}`, "info")
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
			this.logger(`Final approval state set for file: ${relPath}`, "info")
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
					`The user made the following updates to your content:\n\nThe updated content has been successfully saved to ${relPath.toPosix()}
					Here is the latest file content:
					\`\`\`
					${finalContent}
					\`\`\`
					`
				)
			}

			let toolMsg = `The content was successfully saved to ${relPath.toPosix()}.
			Here is the latest file content:
			\`\`\`
			${finalContent}
			\`\`\`
			`
			if (detectCodeOmission(this.diffViewProvider.originalContent || "", finalContent)) {
				this.logger(`Truncated content detected in ${relPath} at ${this.ts}`, "warn")
				toolMsg = `The content was successfully saved to ${relPath.toPosix()},
				but it appears that some code may have been omitted. In caee you didn't write the entire content and included some placeholders or omitted critical parts, please try again with the full output of the code without any omissions / truncations anything similar to "remain", "remains", "unchanged", "rest", "previous", "existing", "..." should be avoided.
				Here is the latest file content:
				\`\`\`
				${finalContent}
				\`\`\``
			}

			return this.toolResponse("success", toolMsg)
		} catch (error) {
			this.logger(`Error in processFileWrite: ${error}`, "error")
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "write_to_file",
						content: this.params.input.kodu_content ?? this.params.input.kodu_diff ?? "",
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

	private async showChangesInDiffView(relPath: string, content: string): Promise<void> {
		content = preprocessContent(content)
		if (!this.diffViewProvider.isDiffViewOpen()) {
			await this.diffViewProvider.open(relPath, true)
		}

		await this.diffViewProvider.update(content, true)
	}
}
