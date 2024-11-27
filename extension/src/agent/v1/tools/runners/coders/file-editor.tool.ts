/**
 * Imports for file system operations, diff viewing, and utility functions
 */
import fs from "fs"
import PQueue from "p-queue"
import * as path from "path"
import { ToolResponseV2 } from "../../../../../agent/v1/types"
import { FullFileEditor } from "../../../../../integrations/editor/full-file-editor"
import { ClaudeSayTool } from "../../../../../shared/ExtensionMessage"
import { getCwd, getReadablePath } from "../../../utils"
import { BaseAgentTool } from "../../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../../types"
import { detectCodeOmission } from "./detect-code-omission"
import { checkFileExists, EditBlock, parseDiffBlocks, preprocessContent } from "./utils"

/**
 * FileEditorTool handles file editing operations in the VSCode extension.
 * It provides functionality for:
 * - Showing diffs between file versions
 * - Handling partial updates during file editing
 * - Managing inline edits with search/replace blocks
 * - Processing user approvals for file changes
 *
 * The tool supports both complete file rewrites and partial edits through diff blocks.
 * It includes features for animation control and update throttling to ensure smooth performance.
 */
export class FileEditorTool extends BaseAgentTool {
	/** Tool parameters including update callbacks and input */
	protected params: AgentToolParams
	/** Provider for showing file diffs in VSCode */
	private editor: FullFileEditor
	/** Flag indicating if final content is being processed */
	private isProcessingFinalContent: boolean = false
	/** Timestamp of last update for throttling */
	private lastUpdateTime: number = 0
	/** Minimum interval between updates in milliseconds */
	private readonly UPDATE_INTERVAL = 16
	/** Queue for processing partial updates sequentially */
	private pQueue: PQueue = new PQueue({ concurrency: 1 })
	/** Flag to control write animation display */
	private skipWriteAnimation: boolean = false
	/** Counter for tracking update sequence */
	private updateNumber: number = 0
	/** Array of edit blocks being processed */
	private editBlocks: EditBlock[] = []
	/** Current file state including path and content */
	private fileState?: {
		absolutePath: string
		orignalContent: string
		isExistingFile: boolean
	}
	/** ID of the last applied edit block */
	private lastAppliedEditBlockId: string = ""

	/**
	 * Initializes the FileEditorTool with required parameters and options.
	 * Sets up diff view provider and inline editor handler.
	 * Configures animation settings based on state manager.
	 *
	 * @param params - Tool parameters including callbacks and input
	 * @param options - Configuration options for the tool
	 */
	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.editor = new FullFileEditor(getCwd(), this.koduDev)
		if (!!this.koduDev.getStateManager().skipWriteAnimation) {
			this.skipWriteAnimation = true
		}
	}

	override async execute() {
		const result = await this.processFileWrite()
		return result
	}

	public async _handlePartialUpdateDiff(relPath: string, diff: string): Promise<void> {
		if (this.isProcessingFinalContent) {
			this.logger("Skipping partial update because the tool is processing the final content.", "warn")
			return
		}

		this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "write_to_file",
					diff,
					path: relPath,
					content: diff,
					ts: this.ts,
					approvalState: "loading",
				},
			},
			this.ts
		)

		if (!diff.includes("REPLACE")) {
			this.logger("Skipping partial update because the diff does not contain REPLACE keyword.", "warn")
			return
		}

		if (this.skipWriteAnimation) {
			return
		}

		try {
			this.editBlocks = parseDiffBlocks(diff, this.fileState!.absolutePath)
		} catch (err) {
			this.logger(`Error parsing diff blocks: ${err}`, "error")
			return
		}

		if (!this.editor.isOpen()) {
			try {
				await this.editor.open(
					this.editBlocks[0].id,
					this.fileState!.absolutePath,
					this.editBlocks[0].searchContent
				)
			} catch (e) {
				this.logger("Error opening editor: " + e, "error")
				return
			}
		}

		if (this.editBlocks.length > 0) {
			const currentBlock = this.editBlocks.at(-1)
			if (!currentBlock?.replaceContent) {
				return
			}

			if (!this.editBlocks.some((block) => block.id === currentBlock.id)) {
				if (this.lastAppliedEditBlockId) {
					const lastBlock = this.editBlocks.find((block) => block.id === this.lastAppliedEditBlockId)
					if (lastBlock) {
						await this.editor.applyFinalContent(
							lastBlock.id,
							lastBlock.searchContent,
							lastBlock.replaceContent
						)
					}
				}

				await this.editor.open(currentBlock.id, this.fileState!.absolutePath, currentBlock.searchContent)
				this.editBlocks.push({
					id: currentBlock.id,
					replaceContent: currentBlock.replaceContent,
					path: this.fileState!.absolutePath,
					searchContent: currentBlock.searchContent,
				})
				this.lastAppliedEditBlockId = currentBlock.id
			}

			const blockData = this.editBlocks.find((block) => block.id === currentBlock.id)
			if (blockData) {
				blockData.replaceContent = currentBlock.replaceContent
				await this.editor.applyStreamContent(
					currentBlock.id,
					currentBlock.searchContent,
					currentBlock.replaceContent
				)
			}
		}

		if (this.lastAppliedEditBlockId) {
			const lastBlock = this.editBlocks.find((block) => block.id === this.lastAppliedEditBlockId)
			if (lastBlock) {
				await this.editor.applyFinalContent(
					lastBlock.id,
					lastBlock.searchContent,
					lastBlock.replaceContent
				)
			}
		}
	}

	public async handlePartialUpdateDiff(relPath: string, diff: string): Promise<void> {
		if (!this.fileState) {
			const absolutePath = path.resolve(getCwd(), relPath)
			const isExistingFile = await checkFileExists(relPath)
			if (!isExistingFile) {
				this.logger(`File does not exist: ${relPath}`, "error")
				this.fileState = {
					absolutePath,
					orignalContent: "",
					isExistingFile: false,
				}
				return
			}
			const originalContent = fs.readFileSync(absolutePath, "utf8")
			this.fileState = {
				absolutePath,
				orignalContent: originalContent,
				isExistingFile,
			}
		}

		if (this.isProcessingFinalContent) {
			this.logger("Skipping partial update because the tool is processing the final content.", "warn")
			return
		}
		this.pQueue.add(() => this._handlePartialUpdateDiff(relPath, diff))
	}

	public async handlePartialUpdate(relPath: string, accumulatedContent: string): Promise<void> {
		if (!this.fileState) {
			const absolutePath = path.resolve(getCwd(), relPath)
			const isExistingFile = await checkFileExists(relPath)
			if (!isExistingFile) {
				this.logger(`File does not exist: ${relPath}`, "error")
				this.fileState = {
					absolutePath,
					orignalContent: "",
					isExistingFile: false,
				}
			} else {
				const originalContent = fs.readFileSync(absolutePath, "utf8")
				this.fileState = {
					absolutePath,
					orignalContent: originalContent,
					isExistingFile,
				}
			}
		}

		if (this.isProcessingFinalContent) {
			this.logger("Skipping partial update because the tool is processing the final content.", "warn")
			return
		}

		this.updateNumber++
		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "write_to_file",
					content: accumulatedContent,
					path: relPath,
					ts: this.ts,
					approvalState: "loading",
				},
			},
			this.ts
		)

		const currentTime = Date.now()
		if (currentTime - this.lastUpdateTime < this.UPDATE_INTERVAL) {
			return
		}

		if (!this.editor.isOpen() && this.updateNumber === 1) {
			try {
				await this.editor.open("streaming", this.fileState.absolutePath, accumulatedContent)
			} catch (e) {
				this.logger("Error opening editor: " + e, "error")
				return
			}
		}
		await this.editor.applyStreamContent("streaming", accumulatedContent, accumulatedContent)
		this.lastUpdateTime = currentTime
	}

	private async finalizeInlineEdit(path: string, content: string): Promise<ToolResponseV2> {
		this.isProcessingFinalContent = true
		try {
			this.editBlocks = parseDiffBlocks(content, path)
		} catch (err) {
			this.logger(`Error parsing diff blocks: ${err}`, "error")
			throw new Error(`Error parsing diff blocks: ${err}`)
		}

		if (!this.editor.isOpen()) {
			await this.editor.open(
				this.editBlocks[0].id,
				this.fileState?.absolutePath!,
				this.editBlocks[0].searchContent
			)
		}

		// Apply all blocks and show final diff view
		for (const block of this.editBlocks) {
			await this.editor.applyFinalContent(block.id, block.searchContent, block.replaceContent)
		}

		const { response, text, images } = await this.params.ask(
			"tool",
			{
				tool: {
					tool: "write_to_file",
					content,
					approvalState: "pending",
					path,
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
						content,
						approvalState: "rejected",
						path,
						ts: this.ts,
						userFeedback: text,
					},
				},
				this.ts
			)

			await this.editor.rejectChanges()
			if (response === "noButtonTapped") {
				return this.toolResponse("rejected", "Write operation cancelled by user.")
			}

			await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
			return this.toolResponse(
				"feedback",
				`The user denied this operation with the following feedback:\n<user_feedback>${text ?? "No text feedback provided. check the images for more details."
				}</user_feedback>`,
				images
			)
		}

		const { finalContent, userEdits } = await this.editor.saveChanges()
		this.koduDev.getStateManager().addErrorPath(path)

		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "write_to_file",
					content,
					approvalState: "approved",
					path,
					ts: this.ts,
				},
			},
			this.ts
		)

		if (userEdits) {
			await this.params.say(
				"user_feedback_diff",
				JSON.stringify({
					tool: this.fileState?.isExistingFile ? "editedExistingFile" : "newFileCreated",
					path: getReadablePath(getCwd(), path),
					diff: userEdits,
				} as ClaudeSayTool)
			)
		}

		const currentOutputMode = this.koduDev.getStateManager().inlineEditOutputType
		if (currentOutputMode === "diff") {
			return this.toolResponse(
				"success",
				`The content was successfully saved to ${path.toPosix()}
				Here is the latests updates to the file after the changes were applied all the previous is the same as the original content except for the changes made, remember this for future reference:
				<file>
				<path>${path}</path>
				<updated_blocks>${this.editBlocks
					.map((block) => {
						return `<block id="${block.id}">${block.replaceContent}</block>`
					})
					.join("\n")}</updated_blocks>
				</file>
				`
			)
		}

		if (currentOutputMode === "none") {
			return this.toolResponse(
				"success",
				`The content was successfully saved to ${path.toPosix()}
				use the search and replace blocks as future reference for the changes made to the file, you should remember them while priotizing the latest content as the source of truth (original + changes made)`
			)
		}

		return this.toolResponse(
			"success",
			`The content was successfully saved to ${path.toPosix()}
			Here is the file latest content after the changes were applied from now on view this as the source of truth for this file unless you make further changes or the user tells you otherwise:
			<file>
			<path>${path}</path>
			<content>${finalContent}</content>
			</file>
			`
		)
	}

	private async processFileWrite() {
		try {
			const { path: relPath, kodu_content: content, kodu_diff: diff } = this.params.input
			if (!relPath) {
				throw new Error("Missing required parameter 'path'")
			}
			this.logger(`Writing to file: ${relPath}`, "info")

			this.isProcessingFinalContent = true
			await this.pQueue.onIdle()

			if (diff) {
				return await this.finalizeInlineEdit(relPath, diff)
			} else if (content) {
				const preprocessedContent = preprocessContent(content)

				// Open editor without showing diff view yet
				await this.editor.open("final", relPath, preprocessedContent)

				// Apply content in memory
				await this.editor.applyStreamContent("final", preprocessedContent, preprocessedContent)

				// Now show final diff and wait for approval
				await this.editor.applyFinalContent("final", preprocessedContent, preprocessedContent)

				const { response, text, images } = await this.params.ask(
					"tool",
					{
						tool: {
							tool: "write_to_file",
							content: preprocessedContent,
							approvalState: "pending",
							path: relPath,
							ts: this.ts,
						},
					},
					this.ts
				)

				if (response !== "yesButtonTapped") {
					await this.editor.rejectChanges()
					return this.handleRejection(response, text, images, preprocessedContent, relPath)
				}

				const { finalContent, userEdits } = await this.editor.saveChanges()
				return this.handleSuccess(relPath, finalContent, userEdits, preprocessedContent)
			}

			throw new Error("Missing required parameter 'kodu_content' or 'kodu_diff'")
		} catch (error) {
			return this.handleError(error)
		} finally {
			this.isProcessingFinalContent = false
		}
	}

	private async handleRejection(
		response: string,
		text: string | undefined,
		images: string[] | undefined,
		content: string,
		path: string
	): Promise<ToolResponseV2> {
		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "write_to_file",
					content,
					approvalState: "rejected",
					path,
					ts: this.ts,
					userFeedback: text,
				},
			},
			this.ts
		)

		if (response === "noButtonTapped") {
			return this.toolResponse("rejected", "Write operation cancelled by user.")
		}

		await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
		return this.toolResponse("feedback", text ?? "The user denied this operation.", images)
	}

	private async handleSuccess(
		path: string,
		finalContent: string,
		userEdits: string | undefined,
		content: string
	): Promise<ToolResponseV2> {
		this.koduDev.getStateManager().addErrorPath(path)

		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "write_to_file",
					content,
					approvalState: "approved",
					path,
					ts: this.ts,
				},
			},
			this.ts
		)

		// Only show user edit message if there were actual edits
		if (userEdits) {
			await this.params.say(
				"user_feedback_diff",
				JSON.stringify({
					tool: this.fileState?.isExistingFile ? "editedExistingFile" : "newFileCreated",
					path: getReadablePath(getCwd(), path),
					diff: userEdits,
				} as ClaudeSayTool)
			)

			return this.toolResponse(
				"success",
				`The user made the following updates to your content:\n\nThe updated content has been successfully saved to ${path.toPosix()}
				Here is the latest file content:
				\`\`\`
				${finalContent}
				\`\`\`
				`
			)
		}

		let toolMsg = `The content was successfully saved to ${path.toPosix()}.
			Here is the latest file content:
			\`\`\`
			${finalContent}
			\`\`\`
			`

		if (detectCodeOmission(this.fileState?.orignalContent || "", finalContent)) {
			this.logger(`Truncated content detected in ${path} at ${this.ts}`, "warn")
			toolMsg = `The content was successfully saved to ${path.toPosix()},
				but it appears that some code may have been omitted. In case you didn't write the entire content and included some placeholders or omitted critical parts, please try again with the full output of the code without any omissions / truncations anything similar to "remain", "remains", "unchanged", "rest", "previous", "existing", "..." should be avoided.
				Here is the latest file content:
				\`\`\`
				${finalContent}
				\`\`\``
		}

		return this.toolResponse("success", toolMsg)
	}

	private handleError(error: unknown): ToolResponseV2 {
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
	}

	public override async abortToolExecution(): Promise<void> {
		if (this.isAbortingTool) {
			return
		}
		this.isAbortingTool = true
		await this.editor.rejectChanges()
	}
}
