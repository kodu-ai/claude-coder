import * as vscode from "vscode"
import * as DMP from "diff-match-patch"
import delay from "delay"

// Assume these are defined somewhere in your codebase.
// A provider that manages the right-hand (modified) virtual document.
import { ModifiedContentProvider, MODIFIED_URI_SCHEME, DIFF_VIEW_URI_SCHEME } from "./decoration-controller"

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

interface BlockResult {
	id: string
	searchContent: string
	replaceContent: string
	wasApplied: boolean
	failureReason?: string
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
 * This class now uses a diff editor to display changes:
 * - The left side is the original file.
 * - The right side is a virtual doc managed by ModifiedContentProvider.
 *
 * Differences from original:
 * - No git markers inserted into the file.
 * - Directly update the "modified" virtual document to show changes.
 * - At the end, save the final content directly to the disk file.
 */
export class InlineEditHandler {
	private isAutoScrollEnabled: boolean = true
	protected currentDocumentState: DocumentState | undefined
	private modifiedUri?: vscode.Uri
	private originalUri?: vscode.Uri
	private static modifiedContentProvider: ModifiedContentProvider = new ModifiedContentProvider()

	constructor() {
		this.logger("InlineEditHandler initialized", "debug")
		if (!vscode.workspace.registerFileSystemProvider) {
			throw new Error("FileSystemProvider not supported in this environment.")
		}
		try {
			vscode.workspace.registerFileSystemProvider(MODIFIED_URI_SCHEME, InlineEditHandler.modifiedContentProvider)
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
			const documentBuffer = await vscode.workspace.fs.readFile(uri)
			const documentContent = Buffer.from(documentBuffer).toString("utf8")

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
	 * This shows the original file content on the left and we will update the right side as we go.
	 */
	private async openDiffEditor(filePath: string, originalContent: string): Promise<void> {
		const fileName = vscode.workspace.asRelativePath(filePath)
		this.originalUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
			query: Buffer.from(originalContent).toString("base64"),
		})

		this.modifiedUri = vscode.Uri.parse(`${MODIFIED_URI_SCHEME}:/${fileName}`)
		await InlineEditHandler.modifiedContentProvider.writeFile(
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

		block.currentContent = content
		block.status = "streaming"

		await this.updateFileContent()
	}

	public async applyFinalContent(id: string, searchContent: string, content: string): Promise<void> {
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
		block.currentContent = content
		block.finalContent = content
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

	private async getDocument(): Promise<vscode.TextDocument | undefined> {
		this.validateDocumentState()
		try {
			const { uri } = this.currentDocumentState
			return vscode.workspace.openTextDocument(uri)
		} catch (error) {
			this.logger(`Failed to get document: ${error}`, "error")
			return undefined
		}
	}

	private findAndReplace(content: string, searchContent: string, replaceContent: string): MatchResult {
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

		if (bestMatch.length > searchContent.length * 0.9) {
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
		let lastEditedLine: number | undefined

		const sortedBlocks = Array.from(this.currentDocumentState.editBlocks.values()).sort((a, b) => {
			const indexA = newContent.indexOf(a.searchContent)
			const indexB = newContent.indexOf(b.searchContent)
			return indexA - indexB
		})

		for (const block of sortedBlocks) {
			const matchResult = this.findAndReplace(newContent, block.searchContent, block.currentContent)

			if (matchResult.success && matchResult.newContent) {
				newContent = matchResult.newContent
				results.push({
					id: block.id,
					searchContent: block.searchContent,
					replaceContent: block.currentContent,
					wasApplied: true,
				})
				// Track where we made changes for scrolling
				if (matchResult.lineStart !== undefined) {
					lastEditedLine = matchResult.lineEnd // scroll to end of replaced content
				}
			} else {
				results.push({
					id: block.id,
					searchContent: block.searchContent,
					replaceContent: block.currentContent,
					wasApplied: false,
					failureReason: matchResult.failureReason,
				})
				this.logger(`Failed to apply block ${block.id}: ${matchResult.failureReason}`, "warn")
			}
		}

		this.currentDocumentState.lastUpdateResults = results
		if (newContent === this.currentDocumentState.currentContent) {
			this.logger("No changes to apply", "info")
			return
		}

		// Update the modified virtual document to show changes in the diff editor
		if (this.modifiedUri) {
			await InlineEditHandler.modifiedContentProvider.writeFile(
				this.modifiedUri,
				new TextEncoder().encode(newContent),
				{ create: false, overwrite: true }
			)
		}

		this.currentDocumentState.currentContent = newContent

		// Scroll to the last edited line if available and auto-scroll is enabled
		if (this.isAutoScrollEnabled && lastEditedLine !== undefined) {
			await this.scrollToLine(lastEditedLine)
		}
	}

	/**
	 * Scrolls the modified side of the diff editor to a specific line.
	 */
	private async scrollToLine(line: number): Promise<void> {
		if (!this.modifiedUri) return

		const editor = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.toString() === this.modifiedUri!.toString()
		)
		if (!editor) return

		const validLine = Math.max(0, Math.min(line, editor.document.lineCount - 1))
		const range = new vscode.Range(validLine, 0, validLine, editor.document.lineAt(validLine).text.length)
		editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
	}

	public async saveChanges(): Promise<{ finalContent: string; results: BlockResult[] }> {
		this.logger("Saving changes", "debug")
		this.validateDocumentState()

		const results = this.currentDocumentState.lastUpdateResults || []
		const finalContent = this.currentDocumentState.currentContent

		// Write finalContent to the file
		const uri = this.currentDocumentState.uri
		const workspaceEdit = new vscode.WorkspaceEdit()
		const document = await vscode.workspace.openTextDocument(uri)
		const entireRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))
		workspaceEdit.replace(uri, entireRange, finalContent)
		await vscode.workspace.applyEdit(workspaceEdit)
		await document.save()

		// Close the diff editor if needed
		await this.closeDiffEditors()

		this.dispose()
		return { finalContent, results }
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
