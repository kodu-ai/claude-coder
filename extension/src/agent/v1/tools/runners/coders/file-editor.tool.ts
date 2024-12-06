/**
 * Imports for file system operations, diff viewing, and utility functions
 */
import * as path from "path"
import { DiffViewProvider } from "../../../../../integrations/editor/diff-view-provider"
import { ClaudeSayTool } from "../../../../../shared/ExtensionMessage"
import { getCwd, getReadablePath } from "../../../utils"
import { BaseAgentTool } from "../../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../../types"
import fs from "fs"
import { detectCodeOmission } from "./detect-code-omission"
import { parseDiffBlocks, checkFileExists, preprocessContent, EditBlock } from "./utils"
import { InlineEditHandler } from "../../../../../integrations/editor/inline-editor"
import { ToolResponseV2 } from "../../../../../agent/v1/types"
import PQueue from "p-queue"

import { GitCommitResult } from "../../../handlers/git-handler"
import { createPatch } from "diff"

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
	public diffViewProvider: DiffViewProvider
	/** Handler for inline file editing operations */
	public inlineEditor: InlineEditHandler
	/** Flag indicating if final content is being processed */
	private isProcessingFinalContent: boolean = false
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
		this.diffViewProvider = new DiffViewProvider(getCwd())
		this.inlineEditor = new InlineEditHandler()
		if (!!this.koduDev.getStateManager().skipWriteAnimation) {
			this.skipWriteAnimation = true
		}
	}

	override async execute() {
		const result = await this.processFileWrite()
		return result
	}

	private commitXMLGenerator(commitResult: GitCommitResult): string {
		return `
<git_commit_info>
    <metadata>
        <branch>${commitResult.branch}</branch>
        <commit_hash>${commitResult.commitHash}</commit_hash>
        <timestamp>${new Date().toISOString()}</timestamp>
    </metadata>
    <description>
        <purpose>Version control reference for future operations</purpose>
        <usage>This commit hash can be used to revert changes or review modifications</usage>
    </description>
</git_commit_info>
`
	}

	public async _handlePartialUpdateDiff(relPath: string, diff: string): Promise<void> {
		if (!this.fileState) {
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "write_to_file",
						diff,
						path: relPath,
						content: diff,
						mode: "inline",
						ts: this.ts,
						approvalState: "loading",
					},
				},
				this.ts
			)
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

		// this might happen because the diff view are not instant.
		if (this.isProcessingFinalContent) {
			this.logger("Skipping partial update because the tool is processing the final content.", "warn")
			return
		}

		if (!diff.includes("REPLACE")) {
			this.logger("Skipping partial update because the diff does not contain REPLACE keyword.", "warn")
			return
		}
		// if the user has skipped the write animation, we don't need to show the diff view until we reach the final state
		if (this.skipWriteAnimation) {
			return
		}
		let editBlocks: EditBlock[] = []
		try {
			editBlocks = parseDiffBlocks(diff, this.fileState.absolutePath)
			this.editBlocks = editBlocks
		} catch (err) {
			this.logger(`Error parsing diff blocks: ${err}`, "error")
			return
		}
		if (!this.inlineEditor.isOpen() && this.editBlocks.length > 0) {
			try {
				await this.inlineEditor.open(
					editBlocks[0].id,
					this.fileState!.absolutePath,
					editBlocks[0].searchContent
				)
			} catch (e) {
				this.logger("Error opening diff view: " + e, "error")
				return
			}
		}
		// now we are going to start applying the diff blocks
		if (editBlocks.length > 0) {
			const currentBlock = editBlocks.at(-1)
			if (!currentBlock?.replaceContent) {
				return
			}

			// If this block hasn't been tracked yet, initialize it
			if (!editBlocks.some((block) => block.id === currentBlock.id)) {
				// Clean up any SEARCH text from the last block before starting new one
				if (this.lastAppliedEditBlockId) {
					const lastBlock = editBlocks.find((block) => block.id === this.lastAppliedEditBlockId)
					if (lastBlock) {
						const lines = lastBlock.replaceContent.split("\n")
						// Only remove the last line if it ONLY contains a partial SEARCH
						if (lines.length > 0 && /^=?=?=?=?=?=?=?$/.test(lines[lines.length - 1].trim())) {
							lines.pop()
							await this.inlineEditor.applyFinalContent(
								lastBlock.id,
								lastBlock.searchContent,
								lines.join("\n")
							)
						} else {
							await this.inlineEditor.applyFinalContent(
								lastBlock.id,
								lastBlock.searchContent,
								lastBlock.replaceContent
							)
						}
					}
				}

				await this.inlineEditor.open(currentBlock.id, this.fileState!.absolutePath, currentBlock.searchContent)
				this.editBlocks.push({
					id: currentBlock.id,
					replaceContent: currentBlock.replaceContent,
					path: this.fileState!.absolutePath,
					searchContent: currentBlock.searchContent,
				})
				this.lastAppliedEditBlockId = currentBlock.id
			}

			const blockData = editBlocks.find((block) => block.id === currentBlock.id)
			if (blockData) {
				blockData.replaceContent = currentBlock.replaceContent
				await this.inlineEditor.applyStreamContent(
					currentBlock.id,
					currentBlock.searchContent,
					currentBlock.replaceContent
				)
			}
		}

		// Finalize the last block
		if (this.lastAppliedEditBlockId) {
			const lastBlock = editBlocks.find((block) => block.id === this.lastAppliedEditBlockId)
			if (lastBlock) {
				await this.inlineEditor.applyFinalContent(
					lastBlock.id,
					lastBlock.searchContent,
					lastBlock.replaceContent
				)
			}
		}
	}

	public async handlePartialUpdateDiff(relPath: string, diff: string): Promise<void> {
		await this.pQueue.add(() => this._handlePartialUpdateDiff(relPath, diff))
	}

	/**
	 *
	 * @param relPath - relative path of the file
	 * @param acculmatedContent - the accumulated content to be written to the file
	 * @returns
	 */
	public async handlePartialUpdate(relPath: string, acculmatedContent: string): Promise<void> {
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
		// this might happen because the diff view are not instant.
		if (this.isProcessingFinalContent) {
			this.logger("Skipping partial update because the tool is processing the final content.", "warn")
			return
		}

		this.updateNumber++
		// if the user has skipped the write animation, we don't need to show the diff view until we reach the final state
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

		await this.pQueue.add(async () => {
			if (!this.diffViewProvider.isDiffViewOpen()) {
				try {
					const now = Date.now()
					await this.diffViewProvider.open(relPath)
					const elapsed = Date.now() - now
					this.logger(`Diff view opened in ${elapsed}ms`, "debug")
				} catch (e) {
					this.logger("Error opening diff view: " + e, "error")
					return
				}
			}
			await this.diffViewProvider.update(acculmatedContent, false)
		})
	}

	private async finalizeInlineEdit(path: string, content: string): Promise<ToolResponseV2> {
		// we are going to parse the content and apply the changes to the file
		this.isProcessingFinalContent = true
		let editBlocks: EditBlock[] = []
		try {
			editBlocks = parseDiffBlocks(content, path)
			this.editBlocks = editBlocks
		} catch (err) {
			this.logger(`Error parsing diff blocks: ${err}`, "error")
			throw new Error(`Error parsing diff blocks: ${err}`)
		}
		if (!this.inlineEditor.isOpen() && editBlocks.length > 0) {
			await this.inlineEditor.open(editBlocks[0]?.id, this.fileState?.absolutePath!, editBlocks[0].searchContent)
		}
		// now we are going to prompt the user to approve the changes
		const { response, text, images } = await this.params.ask(
			"tool",
			{
				tool: {
					tool: "write_to_file",
					content,
					mode: "inline",
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
						mode: "inline",
						approvalState: "rejected",
						path,
						ts: this.ts,
						userFeedback: text,
					},
				},
				this.ts
			)
			// revert the changes
			await this.inlineEditor.rejectChanges()
			if (response === "noButtonTapped") {
				return this.toolResponse("rejected", "Write operation cancelled by user.")
			}
			// If not a yes or no, the user provided feedback (wrote in the input)
			await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
			return this.toolResponse(
				"feedback",
				`The user denied this operation with the following feedback:\n<user_feedback>${
					text ?? "No text feedback provided. check the images for more details."
				}</user_feedback>`,
				images
			)
		}
		const { finalContent, results } = await this.inlineEditor.saveChanges()

		this.koduDev.getStateManager().addErrorPath(path)
		// count how many of the changes were not applied
		const notAppliedCount = results.filter((result) => !result.wasApplied).length
		const validationMsg =
			notAppliedCount === 0
				? `The user might have changed the content of the file, we detected that your changes were initially applied to the file, but the user might have changed the content of the file, please review the file content to make sure that the changes were applied correctly.`
				: `You have failed to apply ${notAppliedCount} changes, this is most likely related to you and the search content you provided, you must provide at least 3 lines of context for the search content to make sure that the changes are applied correctly.`

		const approvedMsg = `
		The user approved the changes and the content was successfully saved to ${path.toPosix()}.
		Make sure to remember the updated content (REPLACE BLOCK + Original FILE) file content unless you change the file again or the user tells you otherwise.
		${validationMsg}
		${
			notAppliedCount > 0
				? `here are are the search blocks that were not applied on this tool execution, if you want to apply them make sure to provide the correct search content, it might be good to refresh your memory with the latest content of the file if you want to re try applying the changes.
		${results.map((result) => `<search_block>${result.searchContent}</search_block>`).join("\n")}`
				: ""
		}
		`

		const currentOutputMode = this.koduDev.getStateManager().inlineEditOutputType

		let commitXmlInfo = ""
		let commitResult: GitCommitResult | undefined
		try {
			commitResult = await this.koduDev.gitHandler.commitOnFileWrite(path)
			commitXmlInfo = this.commitXMLGenerator(commitResult)
		} catch (error) {
			this.logger(`Error committing changes: ${error}`, "error")
		}

		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "write_to_file",
					content,
					mode: "inline",
					approvalState: "approved",
					path,
					ts: this.ts,
					notAppliedCount,
					commitHash: commitResult?.commitHash,
					branch: commitResult?.branch,
				},
			},
			this.ts
		)

		if (currentOutputMode === "diff") {
			// generate a diff between the file original content and the final content
			const diffData = createPatch(path, this.fileState?.orignalContent ?? "", finalContent)
			return this.toolResponse(
				"success",
				`<file_editor_response>
					<status>
						<result>success</result>
						<operation>file_edit_with_diff</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<file_info>
						<path>${path}</path>
						<operation_details>
							<message>${approvedMsg}</message>
							<diff_data>
								<description>Diff data for tracking changes between versions</description>
								<content>${diffData}</content>
							</diff_data>
						</operation_details>
					</file_info>
					${commitXmlInfo}
				</file_editor_response>`,
				undefined,
				commitResult
			)
		}

		if (currentOutputMode === "none") {
			return this.toolResponse(
				"success",
				`
		<file_editor_response>
			<status>
				<result>success</result>
				<operation>file_edit</operation>
				<timestamp>${new Date().toISOString()}</timestamp>
			</status>
			<file_info>
				<path>${path}</path>
				<operation_details>
					<message>${approvedMsg}</message>
					<critical_note>THE CONTENT YOU PROVIDED IN THE REPLACE HAS REPLACED THE SEARCH CONTENT. REMEMBER THIS NEW CONTENT AS THE CURRENT STATE UNTIL FURTHER MODIFICATIONS.</critical_note>
				</operation_details>
				<validation>
					<message>${validationMsg}</message>
				</validation>
			</file_info>
			${commitXmlInfo}
		</file_editor_response>
		`,
				undefined,
				commitResult
			)
		}

		return this.toolResponse(
			"success",
			`
		<update_file_payload>
		<information>
		CRITICAL the file content has been updated to <updated_file_content> content below, you should remember this as the current state of the file unless you change the file again or the user tells you otherwise, if in doubt, re-read the file to get the latest content, but remember that the content below is the latest content and was saved successfully.
		Remember there is no extra need to edit the file unless you forgot to add or remove something or you have linting errors, over editing is a source of looping and getting stuck without thinking through the problem / task.
		</information>
		<path>${path}</path>
		<updated_file_content>
		${finalContent}
		</updated_file_content>
		<validation>${validationMsg}</validation>
		${commitXmlInfo}
		</update_file_payload>
		`,
			undefined,
			commitResult
		)
	}

	private async finalizeFileEdit(relPath: string, content: string): Promise<ToolResponseV2> {
		// Show changes in diff view
		await this.showChangesInDiffView(relPath, content)
		this.logger(`Changes shown in diff view`, "debug")

		this.logger(`Asking for approval to write to file: ${relPath}`, "info")
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

		this.logger(`User approved to write to file: ${relPath}`, "info")

		this.logger(`Saving changes to file: ${relPath}`, "info")
		// Save changes and handle user edits
		const { userEdits, finalContent } = await this.diffViewProvider.saveChanges()
		this.logger(`Changes saved to file: ${relPath}`, "info")
		this.koduDev.getStateManager().addErrorPath(relPath)

		this.logger(`Final approval state set for file: ${relPath}`, "info")

		let commitXmlInfo = ""
		let commitResult: GitCommitResult | undefined
		try {
			commitResult = await this.koduDev.gitHandler.commitOnFileWrite(relPath)
			commitXmlInfo = this.commitXMLGenerator(commitResult)
		} catch (error) {
			this.logger(`Error committing changes: ${error}`, "error")
		}
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
					commitHash: commitResult?.commitHash,
					branch: commitResult?.branch,
				},
			},
			this.ts
		)
		if (userEdits) {
			await this.params.say(
				"user_feedback_diff",
				JSON.stringify({
					tool: this.fileState?.isExistingFile ? "editedExistingFile" : "newFileCreated",
					path: getReadablePath(getCwd(), relPath),
					diff: userEdits,
				} as ClaudeSayTool)
			)
			return this.toolResponse(
				"success",
				`The user made the following updates to your content:\n\nThe updated content has been successfully saved to ${relPath.toPosix()}
					Here is the latest file content after the changes were applied:
					\`\`\`
					${finalContent}
					\`\`\`
					${commitXmlInfo}
					`,
				undefined,
				commitResult
			)
		}

		let toolMsg = `The content was successfully saved to ${relPath.toPosix()}.
			The latest content is the content inside of <kodu_content> the content you provided in the input has been applied to the file and saved. don't read the file again to get the latest content as it is already saved unless the user tells you otherwise.
			${commitXmlInfo}
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

		return this.toolResponse("success", toolMsg, undefined, commitResult)
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
			// wait for the queue to be idle
			await this.pQueue.onIdle()

			if (diff) {
				return await this.finalizeInlineEdit(relPath, diff)
			} else if (content) {
				return await this.finalizeFileEdit(relPath, content)
			} else {
				throw new Error("Missing required parameter 'kodu_content' or 'kodu_diff'")
			}
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
		}
	}

	public override async abortToolExecution(): Promise<void> {
		if (this.isAbortingTool) {
			return
		}
		this.isAbortingTool = true

		// clear the queue
		this.pQueue.clear()
		if (this.params.input.kodu_diff) {
			await this.inlineEditor.rejectChanges()
			await this.inlineEditor.dispose()
		} else {
			await this.diffViewProvider.revertChanges()
			this.diffViewProvider.reset()
		}
	}

	private async showChangesInDiffView(relPath: string, content: string): Promise<void> {
		content = preprocessContent(content)
		if (!this.diffViewProvider.isDiffViewOpen()) {
			await this.diffViewProvider.open(relPath)
		}

		await this.pQueue.add(async () => {
			await this.diffViewProvider.update(content, true)
		})
		await this.pQueue.onIdle()
	}
}
