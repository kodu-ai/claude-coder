import * as path from "path"
import { DiffViewProvider } from "../../../../../integrations/editor/diff-view-provider"
import { ClaudeSayTool } from "../../../../../shared/extension-message"
import { getCwd, getReadablePath } from "../../../utils"
import { BaseAgentTool, FullToolParams } from "../../base-agent.tool"
import { AgentToolOptions } from "../../types"
import fs from "fs"
import { detectCodeOmission } from "./detect-code-omission"
import { parseDiffBlocks, checkFileExists, preprocessContent, EditBlock } from "./utils"
import { InlineEditHandler } from "../../../../../integrations/editor/inline-editor"
import { ToolResponseV2 } from "../../../../../agent/v1/types"
import PQueue from "p-queue"

import { GitCommitResult } from "../../../handlers/git-handler"
import { createPatch } from "diff"
import { FileEditorToolParams } from "../../schema/file_editor_tool"
import { FileVersion } from "../../../types"
import dedent from "dedent"

export class FileEditorTool extends BaseAgentTool<FileEditorToolParams> {
	public diffViewProvider: DiffViewProvider
	public inlineEditor: InlineEditHandler
	private isProcessingFinalContent: boolean = false
	private pQueue: PQueue = new PQueue({ concurrency: 1 })
	private skipWriteAnimation: boolean = false
	private editBlocks: EditBlock[] = []
	private fileState?: {
		absolutePath: string
		orignalContent: string
		isExistingFile: boolean
	}
	private lastAppliedEditBlockId: string = ""

	constructor(params: FullToolParams<FileEditorToolParams>, options: AgentToolOptions) {
		super(params, options)
		this.diffViewProvider = new DiffViewProvider(getCwd())
		this.inlineEditor = new InlineEditHandler()
		if (!!this.koduDev.getStateManager().skipWriteAnimation) {
			this.skipWriteAnimation = true
		}
	}

	override async execute() {
		const mode = this.params.input.mode
		const relPath = this.params.input.path

		if (!relPath) {
			throw new Error("Missing required parameter 'path'")
		}

		switch (mode) {
			case "rollback":
				return this.handleRollback(relPath)
			case "list_versions":
				return this.handleListVersions(relPath)
			case "edit":
			case "whole_write":
				return this.processFileWrite() // existing behavior
			default:
				throw new Error(`Unsupported mode: ${mode}`)
		}
	}

	private commitXMLGenerator(commitResult: GitCommitResult): string {
		return `
<git_commit_info>
    <metadata>
        <branch>${commitResult.branch}</branch>
        <commit_hash>${commitResult.commitHash}</commit_hash>
		<commit_message>${commitResult.commitMessage ?? "No message provided"}</commit_message>
        <timestamp>${new Date().toISOString()}</timestamp>
    </metadata>
    <description>
        <purpose>Version control reference for future operations</purpose>
        <usage>This commit hash can be used to revert changes or review modifications</usage>
    </description>
</git_commit_info>
`
	}

	public async handlePartialUpdateDiff(relPath: string, diff: string): Promise<void> {
		await this.pQueue.add(() => this._handlePartialUpdateDiff(relPath, diff))
	}

	private async _handlePartialUpdateDiff(relPath: string, diff: string): Promise<void> {
		const mode = "edit" // partial updates always mean editing the file

		if (!this.fileState) {
			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "file_editor",
						path: relPath,
						mode,
						kodu_diff: diff,
						approvalState: "loading",
						ts: this.ts,
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
		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path: relPath,
					mode,
					kodu_diff: diff,
					approvalState: "loading",
					ts: this.ts,
				},
			},
			this.ts
		)
		if (this.isProcessingFinalContent) {
			this.logger("Skipping partial update because the tool is processing the final content.", "warn")
			return
		}

		if (!diff.includes("REPLACE")) {
			this.logger("Skipping partial update because the diff does not contain REPLACE keyword.", "warn")
			return
		}

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

		if (editBlocks.length > 0) {
			const currentBlock = editBlocks.at(-1)
			if (!currentBlock?.replaceContent) {
				return
			}

			if (!editBlocks.some((block) => block.id === currentBlock.id)) {
				if (this.lastAppliedEditBlockId) {
					const lastBlock = editBlocks.find((block) => block.id === this.lastAppliedEditBlockId)
					if (lastBlock) {
						const lines = lastBlock.replaceContent.split("\n")
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

	public async handlePartialUpdate(relPath: string, acculmatedContent: string): Promise<void> {
		const mode = "edit" // partial updates are edits
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

		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path: relPath,
					mode,
					kodu_content: acculmatedContent,
					approvalState: "loading",
					ts: this.ts,
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
		const mode = "edit"
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
		const { failedCount, isAllFailed, isAnyFailed, failedBlocks } = await this.inlineEditor.forceFinalize(
			editBlocks
		)
		this.logger(`Failed count: ${failedCount}, isAllFailed: ${isAllFailed}`, "debug")
		if (isAnyFailed) {
			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "file_editor",
						path,
						mode,
						kodu_diff: content,
						approvalState: "error",
						ts: this.ts,
						notAppliedCount: failedCount,
					},
				},
				this.ts
			)
			return this.toolResponse(
				"error",
				dedent`
				<error_message>Failed to apply changes to the file. Please ensure correct search content, if you have a miss match with file content re-read the file.</error_message>
				<not_applied_count>${failedCount}</not_applied_count>
				<failed_to_match_blocks>
				${failedBlocks?.map(
					(block) =>
						dedent`
				<failed_block>
					<search_content>${block.searchContent}</search_content>
					<replace_content>${block.replaceContent}</replace_content>
				</failed_block>
				`
				)}
				</failed_to_match_blocks>
				`
			)
		}
		const { response, text, images } = await this.params.ask(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path,
					mode,
					kodu_diff: content,
					approvalState: "pending",
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
						tool: "file_editor",
						path,
						mode,
						kodu_diff: content,
						approvalState: "rejected",
						ts: this.ts,
						userFeedback: text,
					},
				},
				this.ts
			)
			await this.inlineEditor.rejectChanges()
			if (response === "noButtonTapped") {
				return this.toolResponse("rejected", "Write operation cancelled by user.")
			}
			await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
			return this.toolResponse(
				"feedback",
				`The user denied this operation:\n<user_feedback>${
					text ?? "No text feedback provided."
				}</user_feedback>`,
				images
			)
		}
		const { finalContent, results } = await this.inlineEditor.saveChanges()

		this.koduDev.getStateManager().addErrorPath(path)

		const notAppliedCount = results.filter((result) => !result.wasApplied).length
		const validationMsg =
			notAppliedCount === 0
				? `Your changes were applied, but always double-check correctness.`
				: `Failed to apply ${notAppliedCount} changes. Verify the search content and ensure correct context.`

		let commitXmlInfo = ""
		let commitResult: GitCommitResult | undefined
		try {
			commitResult = await this.koduDev.gitHandler.commitOnFileWrite(path, this.params.input.commit_message)
			commitXmlInfo = this.commitXMLGenerator(commitResult)
		} catch (error) {
			this.logger(`Error committing changes: ${error}`, "error")
		}
		const fileChangesetMessage = commitResult?.commitMessage
			? `<file_changeset_message>${commitResult.commitMessage}</file_changeset_message>`
			: ""
		// Save a new file version
		const newVersion = await this.saveNewFileVersion(path, finalContent)
		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path,
					mode,
					kodu_diff: content,
					approvalState: "approved",
					ts: this.ts,
					saved_version: newVersion.version.toString(),
					notAppliedCount,
					commitHash: commitResult?.commitHash,
					branch: commitResult?.branch,
				},
			},
			this.ts
		)

		const currentOutputMode = this.koduDev.getStateManager().inlineEditOutputType
		if (currentOutputMode === "diff") {
			return this.toolResponse(
				"success",
				dedent`<file_editor_response>
					<status>
						<result>success</result>
						<operation>file_edit_with_diff</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
						<validation>${validationMsg}</validation>
						${commitXmlInfo}
						</status>
						<file_info>
						<path>${path}</path>
						<file_version>${newVersion.version}</file_version>
						${fileChangesetMessage}
						<file_version_timestamp>${new Date(newVersion.createdAt).toISOString()}</file_version_timestamp>
						<information>The updated file content is shown below. This reflects the change that were applied and their current position in the file.
						This should act as a source of truth for the changes that were made unless further modifications were made after this point.
						</information>
						<updated_file_content_blocks>
							${results.map((res) => res.formattedSavedArea).join("\n-------\n")}
						</updated_file_content_blocks>
					</file_info>
				</file_editor_response>`,
				undefined,
				commitResult
			)
		}

		return this.toolResponse(
			"success",
			dedent`
		<file_editor_response>
		<status>
			<result>success</result>
			<operation>file_edit_with_diff</operation>
			<timestamp>${new Date().toISOString()}</timestamp>
			<validation>${validationMsg}</validation>
			${commitXmlInfo}
			</status>
			<file_info>
			<path>${path}</path>
			<file_version>${newVersion.version}</file_version>
			${fileChangesetMessage}
			<file_version_timestamp>${new Date(newVersion.createdAt).toISOString()}</file_version_timestamp>
			<information>The updated file content is shown below at <update_file_content>. This reflects the change that were applied and their current position in the file.
			This should act as a source of truth for the changes that were made unless further modifications were made after this point.
			It includes the entire latest file content with the applied changes and the latest file line numbers and content.
			</information>
			<updated_file_content>
				${finalContent}
			</updated_file_content>
		</file_info>
		</file_editor_response>
		`,
			undefined,
			commitResult
		)
	}

	private async finalizeFileEdit(relPath: string, content: string): Promise<ToolResponseV2> {
		// determine mode based on whether content is entire or partial
		// If kodu_content is provided from input, it likely means whole content replacement. If kodu_diff, it's edit.
		// If we got here without diff, that means it's a "whole" operation.
		const mode = "whole_write"

		await this.showChangesInDiffView(relPath, content)
		this.logger(`Asking for approval to write to file: ${relPath}`, "info")

		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path: relPath,
					mode,
					kodu_content: content,
					approvalState: "pending",
					ts: this.ts,
				},
			},
			this.ts
		)

		const { response, text, images } = await this.params.ask(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path: relPath,
					mode,
					kodu_content: content,
					approvalState: "pending",
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
						tool: "file_editor",
						path: relPath,
						mode,
						kodu_content: content,
						approvalState: "rejected",
						ts: this.ts,
						userFeedback: text,
					},
				},
				this.ts
			)
			await this.diffViewProvider.revertChanges()

			if (response === "noButtonTapped") {
				return this.toolResponse("rejected", "Write operation cancelled by user.")
			}
			await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
			return this.toolResponse("feedback", text ?? "The user denied this operation.", images)
		}

		this.logger(`User approved to write to file: ${relPath}`, "info")
		const { userEdits, finalContent } = await this.diffViewProvider.saveChanges()
		this.logger(`Changes saved to file: ${relPath}`, "info")
		this.koduDev.getStateManager().addErrorPath(relPath)

		let commitXmlInfo = ""
		let commitResult: GitCommitResult | undefined
		try {
			commitResult = await this.koduDev.gitHandler.commitOnFileWrite(relPath, this.params.input.commit_message)
			commitXmlInfo = this.commitXMLGenerator(commitResult)
		} catch (error) {
			this.logger(`Error committing changes: ${error}`, "error")
		}
		const newVersion = await this.saveNewFileVersion(relPath, finalContent)

		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path: relPath,
					mode,
					kodu_content: content,
					saved_version: newVersion.version.toString(),
					approvalState: "approved",
					ts: this.ts,
					commitHash: commitResult?.commitHash,
					branch: commitResult?.branch,
				},
			},
			this.ts
		)

		let toolMsg = `The content was successfully saved to ${relPath.toPosix()}.
			<file_version>${newVersion.version}</file_version>
			<file_version_timestamp>${new Date(newVersion.createdAt).toISOString()}</file_version_timestamp>
			${commitXmlInfo}
		`
		if (detectCodeOmission(this.diffViewProvider.originalContent || "", finalContent)) {
			this.logger(`Truncated content detected in ${relPath} at ${this.ts}`, "warn")
			toolMsg = `The content was successfully saved to ${relPath.toPosix()},
				but some code may have been omitted. Please ensure the full content is correct.
				<file_version>${newVersion.version}</file_version>
				<file_version_timestamp>${new Date(newVersion.createdAt).toISOString()}</file_version_timestamp>
				${commitXmlInfo}`
		}

		if (userEdits) {
			await this.params.say(
				"user_feedback_diff",
				JSON.stringify({
					tool: this.fileState?.isExistingFile ? "editedExistingFile" : "newFileCreated",
					path: getReadablePath(getCwd(), relPath),
					diff: userEdits,
				} as ClaudeSayTool)
			)
			return this.toolResponse("success", toolMsg, undefined, commitResult)
		}

			undefined,
			commitResult
		)
	}

	private async processFileWrite() {
		try {
			const { path: relPath, kodu_content: content, kodu_diff: diff, mode } = this.params.input
			if (!relPath) {
				throw new Error("Missing required parameter 'path'")
			}
			this.logger(`Writing to file: ${relPath}`, "info")

			this.isProcessingFinalContent = true
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
			const mode = this.params.input.mode
			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "file_editor",
						path: this.params.input.path ?? "",
						mode,
						kodu_content: this.params.input.kodu_content ?? undefined,
						kodu_diff: this.params.input.kodu_diff ?? undefined,
						approvalState: "error",
						ts: this.ts,
						error: `Failed to write to file`,
					},
				},
				this.ts
			)

			return this.toolResponse(
				"error",
				`Write to File Error: ${error instanceof Error ? error.message : String(error)}`
			)
		} finally {
			this.isProcessingFinalContent = false
		}
	}

	public override async abortToolExecution(): Promise<{ didAbort: boolean }> {
		const { didAbort } = await super.abortToolExecution()

		if (didAbort) {
			this.pQueue.clear()
			if (this.params.input.kodu_diff) {
				await this.inlineEditor.rejectChanges()
				await this.inlineEditor.dispose()
			} else {
				await this.diffViewProvider.revertChanges()
				this.diffViewProvider.reset()
			}
		}

		return { didAbort }
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

	/**
	 * Saves a new file version after changes are made to the file.
	 */
	private async saveNewFileVersion(relPath: string, content: string): Promise<FileVersion> {
		const versions = await this.koduDev.getStateManager().getFileVersions(relPath)
		const nextVersion = versions.length > 0 ? Math.max(...versions.map((v) => v.version)) + 1 : 1
		const newVersion: FileVersion = {
			path: relPath,
			version: nextVersion,
			createdAt: Date.now(),
			content,
		}
		await this.koduDev.getStateManager().saveFileVersion(newVersion)
		return newVersion
	}

	private async handleRollback(relPath: string): Promise<ToolResponseV2> {
		const mode = "rollback"
		const rollbackVersionStr = this.params.input.rollback_version
		if (!rollbackVersionStr) {
			return this.toolResponse("error", "Missing rollback_version parameter.")
		}
		const rollbackVersion = parseInt(rollbackVersionStr, 10)
		if (isNaN(rollbackVersion)) {
			return this.toolResponse("error", "rollback_version must be a number.")
		}

		const versions = await this.koduDev.getStateManager().getFileVersions(relPath)
		const versionToRollback = versions.find((v) => v.version === rollbackVersion)
		if (!versionToRollback) {
			return this.toolResponse("error", `Version ${rollbackVersion} not found for file ${relPath}`)
		}

		// Show using the native diff view:
		const absolutePath = path.resolve(getCwd(), relPath)
		const isExistingFile = await checkFileExists(relPath)
		let originalContent = ""
		if (isExistingFile) {
			originalContent = fs.readFileSync(absolutePath, "utf8")
		}

		await this.diffViewProvider.open(relPath)
		await this.diffViewProvider.update(versionToRollback.content, true)

		// Ask for approval (pending)
		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path: relPath,
					mode,
					kodu_content: versionToRollback.content,
					rollback_version: rollbackVersionStr,
					approvalState: "pending",
					ts: this.ts,
				},
			},
			this.ts
		)

		const { response, text, images } = await this.params.ask(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path: relPath,
					mode,
					kodu_content: versionToRollback.content,
					rollback_version: rollbackVersionStr,
					approvalState: "pending",
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
						tool: "file_editor",
						path: relPath,
						mode,
						kodu_content: versionToRollback.content,
						rollback_version: rollbackVersionStr,
						approvalState: "rejected",
						userFeedback: text,
						ts: this.ts,
					},
				},
				this.ts
			)
			await this.diffViewProvider.revertChanges()
			return this.toolResponse("rejected", "Rollback operation cancelled by user.")
		}

		// Approved
		await this.diffViewProvider.saveChanges()
		this.koduDev.getStateManager().addErrorPath(relPath)
		let commitXmlInfo = ""
		let commitResult: GitCommitResult | undefined
		try {
			commitResult = await this.koduDev.gitHandler.commitOnFileWrite(relPath, this.params.input.commit_message)
			commitXmlInfo = this.commitXMLGenerator(commitResult)
		} catch {}

		const newVersion = await this.saveNewFileVersion(relPath, versionToRollback.content)

		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path: relPath,
					mode,
					kodu_content: versionToRollback.content,
					rollback_version: rollbackVersionStr,
					approvalState: "approved",
					ts: this.ts,
					commitHash: commitResult?.commitHash,
					branch: commitResult?.branch,
				},
			},
			this.ts
		)

		return this.toolResponse(
			"success",
			`
	<rollback_response>
		<status>success</status>
		<operation>rollback</operation>
		<rolled_back_version>${rollbackVersion}</rolled_back_version>
		<new_version>${newVersion.version}</new_version>
		<file_version_timestamp>${new Date(newVersion.createdAt).toISOString()}</file_version_timestamp>
		${commitXmlInfo}
	</rollback_response>
	`
		)
	}

	private async handleListVersions(relPath: string): Promise<ToolResponseV2> {
		const mode = "list_versions"
		const versions = await this.koduDev.getStateManager().getFileVersions(relPath)
		if (versions.length === 0) {
			const noVersionsMsg = `No versions found.`
			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "file_editor",
						path: relPath,
						mode,
						list_versions_output: noVersionsMsg,
						approvalState: "approved",
						ts: this.ts,
					},
				},
				this.ts
			)
			return this.toolResponse(
				"success",
				`<list_versions><file>${relPath}</file><versions>${noVersionsMsg}</versions></list_versions>`
			)
		}

		const versionsXml = versions
			.map(
				(v) =>
					`<version><number>${v.version}</number><timestamp>${new Date(
						v.createdAt
					).toISOString()}</timestamp></version>`
			)
			.join("\n")

		const msg = `<list_versions><file>${relPath}</file><versions>${versionsXml}</versions></list_versions>`
		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "file_editor",
					path: relPath,
					mode,
					list_versions_output: msg,
					approvalState: "approved",
					ts: this.ts,
				},
			},
			this.ts
		)
		return this.toolResponse("success", msg)
	}
}
