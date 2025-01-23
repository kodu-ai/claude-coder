import * as vscode from "vscode"
import * as path from "path"
import * as DMP from "diff-match-patch"
import delay from "delay"

// Assume these are defined somewhere in your codebase.
// A provider that manages the right-hand (modified) virtual document.
import {
	ModifiedContentProvider,
	INLINE_MODIFIED_URI_SCHEME as MODIFIED_URI_SCHEME,
	INLINE_DIFF_VIEW_URI_SCHEME as DIFF_VIEW_URI_SCHEME,
} from "./decoration-controller"
import { createPatch } from "diff"
import { formatFileToLines } from "../../agent/v1/tools/runners/read-file/utils"

interface MatchResult {
	success: boolean
	newContent?: string
	lineStart?: number
	lineEnd?: number
	failureReason?: string
}

interface EditBlock {
	id: string
	searchContent: string
	currentContent: string
	finalContent?: string
	status: "pending" | "streaming" | "final"
	matchedLocation?: {
		lineStart: number
		lineEnd: number
	}
	dmpAttempted?: boolean
}

export interface BlockResult {
	id: string
	searchContent: string
	replaceContent: string
	wasApplied: boolean
	failureReason?: string
	lineStart?: number
	lineEnd?: number
	formattedSavedArea?: string
}

interface DocumentState {
	uri: vscode.Uri
	originalContent: string
	currentContent: string
	editBlocks: Map<string, EditBlock>
	editBlocksInsertionIndex: Map<string, number>
	lastInsertionIndex: number
	lastUpdateResults?: BlockResult[]
}

/**
 * This class uses a diff editor to display changes:
 * - Left side: original file (read-only)
 * - Right side: a virtual doc managed by ModifiedContentProvider (updated in-memory)
 *
 * After applying edits, we always scroll to the last inserted edit block, ensuring the most recently added block is visible.
 *
 * Changes:
 * - Added `forceFinalize()` method.
 * - Normalized line endings to handle Windows environments better.
 * - Removed usage of `vscode.workspace.asRelativePath` for the diff title to reduce path issues on Windows.
 * - Added small delays to help ensure updates propagate in environments where timing is an issue.
 */
export class InlineEditHandler {
	private isAutoScrollEnabled: boolean = true
	protected currentDocumentState: DocumentState | undefined
	private modifiedUri?: vscode.Uri
	private originalUri?: vscode.Uri
	private static modifiedContentProvider: ModifiedContentProvider | undefined

	constructor() {
		this.logger("InlineEditHandler initialized", "debug")
		if (!vscode.workspace.registerFileSystemProvider) {
			throw new Error("FileSystemProvider not supported in this environment.")
		}
		try {
			// Register provider if not already registered
			if (!InlineEditHandler.modifiedContentProvider) {
				InlineEditHandler.modifiedContentProvider = new ModifiedContentProvider()
				vscode.workspace.registerFileSystemProvider(
					MODIFIED_URI_SCHEME,
					InlineEditHandler.modifiedContentProvider
				)
			}
		} catch (e) {
			this.logger(`Failed to register file system provider: ${e}`, "error")
		}
	}

	public async open(id: string, filePath: string, searchContent: string): Promise<void> {
		this.logger(`Opening file ${filePath} with id ${id}`, "debug")
		try {
			if (this.currentDocumentState) {
				this.logger(`Document already open, no need to open again`, "debug")
				return
			}
			const uri = vscode.Uri.file(filePath)
			let documentBuffer = await vscode.workspace.fs.readFile(uri)
			let documentContent = Buffer.from(documentBuffer).toString("utf8")

			// Normalize line endings to LF to ensure consistency across OS
			documentContent = documentContent.replace(/\r\n/g, "\n")

			this.currentDocumentState = {
				uri: uri,
				originalContent: documentContent,
				currentContent: documentContent,
				editBlocks: new Map(),
				editBlocksInsertionIndex: new Map(),
				lastInsertionIndex: 0,
			}
			this.currentDocumentState.editBlocks.set(id, {
				id,
				searchContent,
				currentContent: searchContent,
				status: "pending",
			})
			this.currentDocumentState.lastInsertionIndex++
			this.currentDocumentState.editBlocksInsertionIndex.set(id, this.currentDocumentState.lastInsertionIndex)

			await this.openDiffEditor(filePath, documentContent)

			this.logger(`Successfully opened file ${filePath}`, "debug")
			return
		} catch (error) {
			this.logger(`Failed to open document: ${error}`, "error")
			throw error
		}
	}

	/**
	 * Open a diff editor: left side = original (virtual), right side = modified (virtual).
	 * Use path.basename for display name to avoid path issues on Windows.
	 */
	private async openDiffEditor(filePath: string, originalContent: string): Promise<void> {
		const fileName = path.basename(filePath)
		this.originalUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
			query: Buffer.from(originalContent).toString("base64"),
		})

		this.modifiedUri = vscode.Uri.parse(`${MODIFIED_URI_SCHEME}:/${fileName}`)
		await InlineEditHandler.modifiedContentProvider!.writeFile(
			this.modifiedUri,
			new TextEncoder().encode(originalContent),
			{ create: true, overwrite: true }
		)

		await vscode.commands.executeCommand(
			"vscode.diff",
			this.originalUri,
			this.modifiedUri,
			`${fileName}: Original ↔ Changes`,
			{
				preview: false,
				preserveFocus: false,
				viewColumn: vscode.ViewColumn.Active,
			}
		)

		// Small delay to ensure editor is visible and stable on all OS
		await delay(50)
	}

	public async applyStreamContent(id: string, searchContent: string, content: string): Promise<void> {
		this.logger(`Applying stream content for id ${id}`, "debug")
		if (!this.isOpen()) {
			this.logger(`Editor not open, opening now`, "debug")
			await this.open(id, searchContent, content)
		}

		this.validateDocumentState()
		let block = this.currentDocumentState.editBlocks.get(id)
		if (!block) {
			block = {
				id,
				searchContent,
				currentContent: searchContent,
				status: "pending",
			}
			this.currentDocumentState.editBlocks.set(id, block)
			this.currentDocumentState.lastInsertionIndex++
			this.currentDocumentState.editBlocksInsertionIndex.set(id, this.currentDocumentState.lastInsertionIndex)
		}

		// Normalize content to LF
		content = content.replace(/\r\n/g, "\n")

		block.currentContent = content
		block.status = "streaming"

		await this.updateFileContent()
	}

	public async applyFinalContent(id: string, searchContent: string, replaceContent: string): Promise<void> {
		this.logger(`Applying final content for id ${id}`, "debug")
		if (!this.isOpen()) {
			this.logger(`Editor not open, queueing final operation for id ${id}`, "debug")
			return
		}
		this.validateDocumentState()
		let block = this.currentDocumentState.editBlocks.get(id)
		if (!block) {
			block = {
				id,
				searchContent,
				currentContent: searchContent,
				status: "pending",
			}
			this.currentDocumentState.editBlocks.set(id, block)
			if (!this.currentDocumentState.editBlocksInsertionIndex.has(id)) {
				this.currentDocumentState.lastInsertionIndex++
				this.currentDocumentState.editBlocksInsertionIndex.set(id, this.currentDocumentState.lastInsertionIndex)
			}
		}

		// Normalize content to LF
		replaceContent = replaceContent.replace(/\r\n/g, "\n")

		block.currentContent = replaceContent
		block.finalContent = replaceContent
		block.status = "final"

		await this.updateFileContent()
	}

	private validateDocumentState(): asserts this is { currentDocumentState: DocumentState } {
		if (!this.currentDocumentState) {
			this.logger("No active document state", "error")
			throw new Error("No active document state.")
		}
	}

	public isOpen(): boolean {
		return !!this.currentDocumentState
	}

	private findAndReplace(content: string, searchContent: string, replaceContent: string): MatchResult {
		// Ensure all strings use LF
		content = content.replace(/\r\n/g, "\n")
		searchContent = searchContent.replace(/\r\n/g, "\n")
		replaceContent = replaceContent.replace(/\r\n/g, "\n")

		const perfectMatch = this.findPerfectMatch(content, searchContent)
		if (perfectMatch.success) {
			return this.performReplace(content, perfectMatch.lineStart!, perfectMatch.lineEnd!, replaceContent)
		}

		const whitespaceMatch = this.findWhitespaceMatch(content, searchContent)
		if (whitespaceMatch.success) {
			return this.performReplace(content, whitespaceMatch.lineStart!, whitespaceMatch.lineEnd!, replaceContent)
		}

		const trailingMatch = this.findTrailingMatch(content, searchContent)
		if (trailingMatch.success) {
			return this.performReplace(content, trailingMatch.lineStart!, trailingMatch.lineEnd!, replaceContent)
		}

		const dmpMatch = this.findDMPMatch(content, searchContent)
		if (dmpMatch.success) {
			return this.performReplace(content, dmpMatch.lineStart!, dmpMatch.lineEnd!, replaceContent)
		}

		return { success: false }
	}

	private performReplace(content: string, startLine: number, endLine: number, replaceContent: string): MatchResult {
		const contentLines = content.split("\n")
		const replaceLines = replaceContent.split("\n")

		const newContentLines = [
			...contentLines.slice(0, startLine),
			...replaceLines,
			...contentLines.slice(endLine + 1),
		]

		return {
			success: true,
			newContent: newContentLines.join("\n"),
			lineStart: startLine,
			lineEnd: startLine + replaceLines.length - 1,
		}
	}

	private findPerfectMatch(content: string, searchContent: string): MatchResult {
		const contentLines = content.split("\n")
		const searchLines = searchContent.split("\n")

		for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
			if (contentLines.slice(i, i + searchLines.length).join("\n") === searchLines.join("\n")) {
				return {
					success: true,
					lineStart: i,
					lineEnd: i + searchLines.length - 1,
				}
			}
		}
		return { success: false }
	}

	private findWhitespaceMatch(content: string, searchContent: string): MatchResult {
		const contentLines = content.split("\n")
		const searchLines = searchContent.split("\n")

		for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
			const matches = searchLines.every((searchLine, j) => {
				const contentLine = contentLines[i + j]
				return contentLine.replace(/\s+/g, " ") === searchLine.replace(/\s+/g, " ")
			})

			if (matches) {
				return {
					success: true,
					lineStart: i,
					lineEnd: i + searchLines.length - 1,
				}
			}
		}
		return { success: false }
	}

	private findTrailingMatch(content: string, searchContent: string): MatchResult {
		const contentLines = content.split("\n")
		const searchLines = searchContent.split("\n")

		for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
			const matches = searchLines.every((searchLine, j) => {
				const contentLine = contentLines[i + j]
				return contentLine.trimEnd() === searchLine.trimEnd()
			})

			if (matches) {
				return {
					success: true,
					lineStart: i,
					lineEnd: i + searchLines.length - 1,
				}
			}
		}
		return { success: false }
	}

	private findDMPMatch(content: string, searchContent: string): MatchResult {
		const dmp = new DMP.diff_match_patch()
		const diffs = dmp.diff_main(content, searchContent)
		dmp.diff_cleanupSemantic(diffs)

		let bestMatch = { start: -1, end: -1, length: 0 }
		let currentPos = 0

		for (const [type, text] of diffs) {
			if (type === 0 && text.length > bestMatch.length) {
				bestMatch = {
					start: currentPos,
					end: currentPos + text.length,
					length: text.length,
				}
			}
			currentPos += text.length
		}

		if (bestMatch.length > searchContent.length * 0.7) {
			const startLine = content.substr(0, bestMatch.start).split("\n").length - 1
			const endLine = startLine + searchContent.split("\n").length - 1

			return { success: true, lineStart: startLine, lineEnd: endLine }
		}

		return { success: false }
	}

	private async updateFileContent(): Promise<void> {
		this.validateDocumentState()

		let newContent = this.currentDocumentState.originalContent
		const results: BlockResult[] = []
		let latestAppliedBlockIndex = -1
		let latestAppliedBlockLineEnd: number | undefined

		// Process blocks in insertion order
		const blocksInInsertionOrder = [...this.currentDocumentState.editBlocks.entries()]
			.sort((a, b) => {
				const indexA = this.currentDocumentState.editBlocksInsertionIndex.get(a[0]) ?? -1
				const indexB = this.currentDocumentState.editBlocksInsertionIndex.get(b[0]) ?? -1
				return indexA - indexB
			})
			.map(([, block]) => block)

		for (const block of blocksInInsertionOrder) {
			const matchResult = this.findAndReplace(newContent, block.searchContent, block.currentContent)

			if (matchResult.success && matchResult.newContent) {
				newContent = matchResult.newContent
				results.push({
					id: block.id,
					searchContent: block.searchContent,
					replaceContent: block.currentContent,
					wasApplied: true,
					lineStart: matchResult.lineStart,
					lineEnd: matchResult.lineEnd,
				})
				const insertionIndex = this.currentDocumentState.editBlocksInsertionIndex.get(block.id) ?? -1
				if (insertionIndex > latestAppliedBlockIndex) {
					latestAppliedBlockIndex = insertionIndex
					latestAppliedBlockLineEnd = matchResult.lineEnd
				}
			} else {
				results.push({
					id: block.id,
					searchContent: block.searchContent,
					replaceContent: block.currentContent,
					wasApplied: false,
					failureReason: matchResult.failureReason,
				})
				this.logger(`Failed to apply block ${block.id}`, "warn")
			}
		}

		this.currentDocumentState.lastUpdateResults = results
		if (newContent === this.currentDocumentState.currentContent) {
			this.logger("No changes to apply", "info")
			return
		}

		if (this.modifiedUri) {
			await InlineEditHandler.modifiedContentProvider!.writeFile(
				this.modifiedUri,
				new TextEncoder().encode(newContent),
				{ create: false, overwrite: true }
			)

			// small delay to ensure doc updates in the editor
			await delay(50)
		}

		this.currentDocumentState.currentContent = newContent

		if (this.isAutoScrollEnabled && latestAppliedBlockIndex !== -1 && latestAppliedBlockLineEnd !== undefined) {
			await this.scrollToLine(latestAppliedBlockLineEnd)
		}
	}

	private async scrollToLine(line: number): Promise<void> {
		if (!this.modifiedUri) {
			return
		}

		const editor = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.toString() === this.modifiedUri!.toString()
		)
		if (!editor) {
			return
		}

		const validLine = Math.max(0, Math.min(line, editor.document.lineCount - 1))
		const range = new vscode.Range(validLine, 0, validLine, editor.document.lineAt(validLine).text.length)
		editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
	}

	public async saveChanges(): Promise<{
		/**
		 * The final content of the file after applying all changes.
		 * Formatted with line numbers for each line.
		 */
		finalContent: string
		results: BlockResult[]
		userEdits?: string
		finalContentRaw: string
	}> {
		this.logger("Saving changes", "debug")
		this.validateDocumentState()

		const results = this.currentDocumentState.lastUpdateResults || []
		const finalStreamedContent = this.currentDocumentState.currentContent

		const uri = this.currentDocumentState.uri
		const workspaceEdit = new vscode.WorkspaceEdit()
		const document = await vscode.workspace.openTextDocument(uri)
		const diffDocument = await vscode.workspace.openTextDocument(this.modifiedUri!)
		const finalContentBeforeSave = diffDocument.getText()
		if (document.isDirty) {
			await document.save()
		}
		if (diffDocument.isDirty) {
			await diffDocument.save()
		}
		/**
		 * fianlContent is formatted with line numbers for each line at the end of the function
		 */
		let finalContent = diffDocument.getText()

		// Close the active editor
		const entireRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))
		workspaceEdit.replace(uri, entireRange, finalContent)
		await vscode.workspace.applyEdit(workspaceEdit)
		await document.save()
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
		await this.closeDiffEditors()
		const finalDoc = await vscode.workspace.openTextDocument(uri)
		// open the file itself in a new editor
		const finalEditor = await vscode.window.showTextDocument(finalDoc, {
			preview: false,
			viewColumn: vscode.ViewColumn.Active,
		})
		// get the content after document is saved to make sure the content is up-to-date + formatted
		finalContent = finalDoc.getText()

		// Now compute formattedSavedArea for each applied result
		const finalLines = finalContent.split("\n")
		for (const result of results) {
			if (result.wasApplied && typeof result.lineStart === "number" && typeof result.lineEnd === "number") {
				// Determine the range of lines to extract: 5 above and 5 below
				const startContext = Math.max(0, result.lineStart - 5)
				const endContext = Math.min(finalLines.length - 1, result.lineEnd + 5)

				const extractedLines = finalLines.slice(startContext, endContext + 1)
				// Format as "LINE_NUMBER  LINE_CONTENT"
				const formatted = extractedLines
					.map((line, index) => {
						const actualLineNumber = startContext + index + 1 // +1 to make line numbers 1-based
						return `${line}`
					})
					.join("\n")

				result.formattedSavedArea = formatted
			}
		}

		// Compare contents and create patch if needed
		const normalizedFinalContent = finalContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
		const normalizedfinalContentBeforeSave = finalContentBeforeSave.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
		const normalizedStreamedContent = finalStreamedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
		const finalContentRaw = finalContent
		finalContent = formatFileToLines(finalContent)

		if (normalizedfinalContentBeforeSave !== normalizedStreamedContent) {
			const filename = path.basename(uri.fsPath).replace(/\\/g, "/") // Ensure forward slashes for consistency
			const patch = createPatch(filename, normalizedStreamedContent, normalizedFinalContent)

			this.dispose()
			return { userEdits: patch, finalContent: normalizedFinalContent, results, finalContentRaw }
		}

		this.dispose()
		return { finalContent, results, finalContentRaw }
	}

	private async closeDiffEditors() {
		const tabs = vscode.window.tabGroups.all
			.flatMap((tg) => tg.tabs)
			.filter(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff &&
					(tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME ||
						tab.input?.modified?.scheme === MODIFIED_URI_SCHEME)
			)
		for (const tab of tabs) {
			if (!tab.isDirty) {
				await vscode.window.tabGroups.close(tab)
			}
		}
	}

	public async rejectChanges(): Promise<void> {
		this.logger("Rejecting changes", "debug")
		this.validateDocumentState()

		const uri = this.currentDocumentState.uri
		const originalContent = this.currentDocumentState.originalContent
		const doc = await vscode.workspace.openTextDocument(uri)
		const workspaceEdit = new vscode.WorkspaceEdit()
		const entireRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
		workspaceEdit.replace(uri, entireRange, originalContent)
		await vscode.workspace.applyEdit(workspaceEdit)
		await doc.save()

		await this.closeDiffEditors()
		this.dispose()
	}

	/**
	 * Force finalize all given blocks by applying their final content and marking them as final,
	 * then re-applying changes to ensure everything is updated.
	 */
	public async forceFinalize(blocks: { id: string; searchContent: string; replaceContent: string }[]): Promise<{
		failedCount: number
		isAllFailed: boolean
		isAnyFailed: boolean
		failedBlocks?: BlockResult[]
		results: BlockResult[]
	}> {
		this.logger("Forcing finalization of given blocks", "debug")
		this.validateDocumentState()

		for (const blk of blocks) {
			let block = this.currentDocumentState.editBlocks.get(blk.id)
			if (!block) {
				block = {
					id: blk.id,
					searchContent: blk.searchContent,
					currentContent: blk.replaceContent.replace(/\r\n/g, "\n"),
					finalContent: blk.replaceContent.replace(/\r\n/g, "\n"),
					status: "final",
				}
				this.currentDocumentState.editBlocks.set(blk.id, block)
				if (!this.currentDocumentState.editBlocksInsertionIndex.has(blk.id)) {
					this.currentDocumentState.lastInsertionIndex++
					this.currentDocumentState.editBlocksInsertionIndex.set(
						blk.id,
						this.currentDocumentState.lastInsertionIndex
					)
				}
			} else {
				block.currentContent = blk.replaceContent.replace(/\r\n/g, "\n")
				block.finalContent = blk.replaceContent.replace(/\r\n/g, "\n")
				block.status = "final"
			}
		}

		// Re-apply changes now that all blocks are final
		await this.updateFileContent()
		const failedBlocks = this.currentDocumentState.lastUpdateResults?.filter((r) => !r.wasApplied) || []
		const isAllFailed = failedBlocks.length === blocks.length
		const isAnyFailed = failedBlocks.length > 0
		if (isAllFailed) {
			this.logger("All blocks failed to apply", "warn")
			// close the editor if all blocks failed
			await this.closeDiffEditors()
			this.dispose()
		}
		return { failedCount: failedBlocks.length, isAllFailed, isAnyFailed, failedBlocks, results: failedBlocks }
	}

	public setAutoScroll(enabled: boolean) {
		this.isAutoScrollEnabled = enabled
		this.logger(`Auto-scroll ${enabled ? "enabled" : "disabled"}`)
	}

	public dispose() {
		this.logger("Disposing InlineEditHandler")
		this.currentDocumentState = undefined
		this.modifiedUri = undefined
		this.originalUri = undefined
	}

	private logger(message: string, level: "info" | "debug" | "warn" | "error" = "debug") {
		const timestamp = new Date().toISOString()
		const isEditorOpen = this.isOpen()
		console[level](`[InlineEditHandler] ${timestamp} | Editor: ${isEditorOpen ? "open" : "closed"} | ${message}`)
	}
}
