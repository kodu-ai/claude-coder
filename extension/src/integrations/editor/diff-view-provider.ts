/**
 * THIS FILE WAS CREATED BY KODU.AI v1.9.19 - https://kodu.ai/
 * THIS LETS KODU STREAM DIFF IN MEMORY AND SHOW IT IN VS CODE
 * ALSO IT UPDATES THE WORKSPACE TIMELINE WITH THE CHANGES
 */
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { createDirectoriesForFile } from "../../utils/fs"
import * as diff from "diff"
import { arePathsEqual } from "../../utils/path-helpers"
import { KoduDev } from "../../agent/v1"
import delay from "delay"
import pWaitFor from "p-wait-for"

// Constants
export const CONSTANTS = {
	DIFF_VIEW_URI_SCHEME: "claude-coder-diff",
	MODIFIED_URI_SCHEME: "claude-coder-modified",
	SCROLL_THROTTLE: 150,
	USER_INTERACTION_TIMEOUT: 1500,
	SCROLL_THRESHOLD: 10,
	UPDATE_BATCH_INTERVAL: 32,
	WAIT_FOR_EDITOR_TIMEOUT: 300,
	WAIT_FOR_EDITOR_INTERVAL: 20,
} as const

const fadedOverlayDecorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: "rgba(255, 255, 0, 0.1)",
	opacity: "0.4",
	isWholeLine: true,
})

const activeLineDecorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: "rgba(255, 255, 0, 0.3)",
	opacity: "1",
	isWholeLine: true,
	border: "1px solid rgba(255, 255, 0, 0.5)",
})

type DecorationType = "fadedOverlay" | "activeLine"
type LogLevel = "info" | "warn" | "error"

class DiffViewError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "DiffViewError"
	}
}

class DecorationController {
	private decorationType: DecorationType
	private editor: vscode.TextEditor
	private ranges: vscode.Range[] = []
	private pendingRanges: vscode.Range[] = []
	private updateTimeout: NodeJS.Timeout | null = null

	constructor(decorationType: DecorationType, editor: vscode.TextEditor) {
		this.decorationType = decorationType
		this.editor = editor
	}

	getDecoration() {
		switch (this.decorationType) {
			case "fadedOverlay":
				return fadedOverlayDecorationType
			case "activeLine":
				return activeLineDecorationType
		}
	}

	addLines(startIndex: number, numLines: number) {
		if (startIndex < 0 || numLines <= 0) {
			return
		}

		const lastRange = this.pendingRanges[this.pendingRanges.length - 1]
		if (lastRange && lastRange.end.line === startIndex - 1) {
			this.pendingRanges[this.pendingRanges.length - 1] = lastRange.with(
				undefined,
				lastRange.end.translate(numLines)
			)
		} else {
			const endLine = startIndex + numLines - 1
			this.pendingRanges.push(new vscode.Range(startIndex, 0, endLine, Number.MAX_SAFE_INTEGER))
		}

		this.scheduleUpdate()
	}

	private scheduleUpdate() {
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout)
		}

		this.updateTimeout = setTimeout(() => {
			this.ranges = [...this.pendingRanges]
			this.pendingRanges = []
			this.editor.setDecorations(this.getDecoration(), this.ranges)
			this.updateTimeout = null
		}, CONSTANTS.UPDATE_BATCH_INTERVAL)
	}

	clear() {
		this.ranges = []
		this.pendingRanges = []
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout)
			this.updateTimeout = null
		}
		this.editor.setDecorations(this.getDecoration(), [])
	}

	updateOverlayAfterLine(line: number, totalLines: number) {
		this.pendingRanges = this.ranges.filter((range) => range.end.line < line)

		if (line < totalLines - 1) {
			this.pendingRanges.push(
				new vscode.Range(
					new vscode.Position(line + 1, 0),
					new vscode.Position(totalLines - 1, Number.MAX_SAFE_INTEGER)
				)
			)
		}

		this.scheduleUpdate()
	}

	setActiveLine(line: number) {
		this.pendingRanges = [new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER)]
		this.scheduleUpdate()
	}
}

class ModifiedContentProvider implements vscode.FileSystemProvider {
	private content = new Map<string, Uint8Array>()
	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>()
	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event

	watch(): vscode.Disposable {
		// VS Code will handle watching for us
		return new vscode.Disposable(() => {})
	}

	stat(uri: vscode.Uri): vscode.FileStat {
		const content = this.content.get(uri.toString())
		if (!content) {
			throw vscode.FileSystemError.FileNotFound(uri)
		}
		return {
			type: vscode.FileType.File,
			ctime: Date.now(),
			mtime: Date.now(),
			size: content.length,
		}
	}

	readFile(uri: vscode.Uri): Uint8Array {
		const content = this.content.get(uri.toString())
		if (!content) {
			throw vscode.FileSystemError.FileNotFound(uri)
		}
		return content
	}

	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
		const uriString = uri.toString()
		const exists = this.content.has(uriString)

		if (!exists && !options.create) {
			throw vscode.FileSystemError.FileNotFound(uri)
		}
		if (exists && !options.overwrite) {
			throw vscode.FileSystemError.FileExists(uri)
		}

		this.content.set(uriString, content)
		this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }])
	}

	delete(uri: vscode.Uri): void {
		const deleted = this.content.delete(uri.toString())
		if (!deleted) {
			throw vscode.FileSystemError.FileNotFound(uri)
		}
		this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }])
	}

	rename(): void {
		throw vscode.FileSystemError.NoPermissions("Rename not supported")
	}

	readDirectory(): [string, vscode.FileType][] {
		return []
	}

	createDirectory(): void {
		throw vscode.FileSystemError.NoPermissions("Directory operations not supported")
	}
}

class DiffViewProvider {
	private diffEditor?: vscode.TextEditor
	public originalContent: string = ""
	public streamedContent: string = ""
	public isEditing: boolean = false
	public relPath?: string
	private originalUri?: vscode.Uri
	private isFinalReached: boolean = false
	private modifiedUri?: vscode.Uri
	public lastEditPosition?: vscode.Position
	private updateTimeout: NodeJS.Timeout | null = null
	private lastScrollTime: number = 0
	private isAutoScrollEnabled: boolean = true
	private lastUserInteraction: number = 0
	private previousContent: string = ""
	private disposables: vscode.Disposable[] = []
	private activeLineController?: DecorationController
	private fadedOverlayController?: DecorationController
	private pendingContent: string = ""
	private lastModifiedLine: number = 0
	private updateScheduled: boolean = false
	private static modifiedContentProvider: ModifiedContentProvider

	constructor(
		private cwd: string,
		koduDev: KoduDev,
		private updateInterval: number = CONSTANTS.UPDATE_BATCH_INTERVAL
	) {
		if (!DiffViewProvider.modifiedContentProvider) {
			DiffViewProvider.modifiedContentProvider = new ModifiedContentProvider()
			try {
				vscode.workspace.registerFileSystemProvider(
					CONSTANTS.MODIFIED_URI_SCHEME,
					DiffViewProvider.modifiedContentProvider
				)
			} catch (e) {
				this.logger(`Failed to register file system provider: ${e}`, "error")
				throw new DiffViewError(`Failed to register file system provider: ${e}`)
			}
		}
	}

	private logger(message: string, level: LogLevel = "info"): void {
		console[level](`[DiffViewProvider] ${message}`)
	}

	public async open(relPath: string, isFinal?: boolean): Promise<void> {
		if (this.diffEditor) {
			return
		}

		this.isEditing = true
		this.relPath = relPath
		this.isAutoScrollEnabled = true
		this.previousContent = ""
		this.pendingContent = ""

		const absolutePath = path.resolve(this.cwd, relPath)

		try {
			this.originalContent = await fs.readFile(absolutePath, "utf-8")
			this.previousContent = this.originalContent
		} catch (error) {
			this.logger(`Failed to read file: ${error}`, "error")
			this.originalContent = ""
		}

		await this.openDiffEditor(relPath, !!isFinal)
		this.activeLineController = new DecorationController("activeLine", this.diffEditor!)
		this.fadedOverlayController = new DecorationController("fadedOverlay", this.diffEditor!)

		this.fadedOverlayController.addLines(0, this.diffEditor!.document.lineCount)
		this.setupEventListeners()
	}

	private setupEventListeners(): void {
		// Clean up existing listeners
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []

		if (this.diffEditor) {
			this.disposables.push(
				vscode.window.onDidChangeTextEditorSelection((e) => {
					if (e.textEditor === this.diffEditor) {
						this.lastUserInteraction = Date.now()
						this.isAutoScrollEnabled = false
					}
				}),
				vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
					if (e.textEditor === this.diffEditor) {
						const now = Date.now()
						if (now - this.lastScrollTime > CONSTANTS.SCROLL_THROTTLE) {
							if (this.checkScrollPosition()) {
								this.isAutoScrollEnabled = true
								this.lastUserInteraction = 0
							} else if (
								this.isAutoScrollEnabled &&
								now - this.lastUserInteraction < CONSTANTS.USER_INTERACTION_TIMEOUT
							) {
								this.isAutoScrollEnabled = false
							}
						}
					}
				})
			)
		}
	}

	public async openDiffEditor(relPath: string, isFinal?: boolean): Promise<void> {
		const absoluteFilePath = path.resolve(this.cwd, relPath)
		const fileName = path.basename(absoluteFilePath)

		// Create a file URI using vscode.Uri.file()
		const fileUri = vscode.Uri.file(absoluteFilePath)

		// Create original content URI with custom scheme and query
		this.originalUri = fileUri.with({
			scheme: CONSTANTS.DIFF_VIEW_URI_SCHEME, // e.g., 'claude-coder-diff'
			query: Buffer.from(this.originalContent ?? "").toString("base64"),
		})

		// Create modified content URI with custom scheme
		this.modifiedUri = fileUri.with({
			scheme: CONSTANTS.MODIFIED_URI_SCHEME, // e.g., 'claude-coder-modified'
		})

		DiffViewProvider.modifiedContentProvider.writeFile(
			this.modifiedUri,
			new TextEncoder().encode(this.originalContent ?? ""),
			{
				create: true,
				overwrite: true,
			}
		)
		await vscode.commands.executeCommand(
			"vscode.diff",
			this.originalUri,
			this.modifiedUri,
			`${fileName}: ${this.originalContent ? "Original ↔ Kodu's Changes" : "New File"} (Editable)`,
			{
				preview: true,
				preserveFocus: false,
				viewColumn: vscode.ViewColumn.Active,
				tabOptions: { readonly: true },
			}
		)

		await this.waitForEditor()
		await this.initializeEditor()
	}

	private async writeContent(uri: vscode.Uri, content: string): Promise<void> {
		try {
			DiffViewProvider.modifiedContentProvider.writeFile(uri, new TextEncoder().encode(content), {
				create: true,
				overwrite: true,
			})
		} catch (error) {
			this.logger(`Failed to write content: ${error}`, "error")
			throw new DiffViewError("Failed to write content")
		}
	}

	private async waitForEditor(): Promise<void> {
		await pWaitFor(() => this.isEditorVisible(), {
			interval: CONSTANTS.WAIT_FOR_EDITOR_INTERVAL,
			timeout: CONSTANTS.WAIT_FOR_EDITOR_TIMEOUT,
		})
	}

	private isEditorVisible(): boolean {
		return vscode.window.visibleTextEditors.some((e) => e.document.uri.toString() === this.modifiedUri!.toString())
	}

	private async initializeEditor(): Promise<void> {
		const editor = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.toString() === this.modifiedUri!.toString()
		)

		if (editor && this.modifiedUri && editor.document.uri.toString() === this.modifiedUri.toString()) {
			this.diffEditor = editor
		} else {
			throw new DiffViewError("Failed to open diff editor")
		}
	}

	public async update(accumulatedContent: string, isFinal: boolean): Promise<void> {
		if (!this.validateEditorState()) {
			return
		}

		if (this.isFinalReached) {
			this.logger("<update>: Final update already reached", "warn")
			return
		}

		if (isFinal) {
			await this.handleFinalUpdate(accumulatedContent)
			return
		}

		this.pendingContent = accumulatedContent
		this.scheduleUpdate()
	}

	private validateEditorState(): boolean {
		if (!this.diffEditor || !this.modifiedUri || !this.activeLineController || !this.fadedOverlayController) {
			this.logger("<update>: Diff editor not initialized", "error")
			return false
		}
		return true
	}

	private async handleFinalUpdate(content: string): Promise<void> {
		if (!this.diffEditor) {
			this.logger("<handleFinalUpdate>: Diff editor not initialized", "error")
			throw new DiffViewError("Diff editor not initialized")
		}
		this.logger(`[${Date.now()}] applying final update: content length ${content.length}`, "info")
		this.isFinalReached = true
		const changePromise = new Promise<void>((resolve) => {
			const disposable = vscode.workspace.onDidChangeTextDocument((e) => {
				if (e.document === this.diffEditor?.document) {
					disposable.dispose()
					resolve()
				}
			})
		})

		this.isFinalReached = true
		const updatedDocument = this.diffEditor.document
		const isPython =
			updatedDocument.languageId === "python" ||
			updatedDocument.languageId === "python2" ||
			updatedDocument.languageId === "python3" ||
			updatedDocument.languageId === "jupyter" ||
			updatedDocument.languageId === "jupyter-notebook"
		if (isPython) {
			content = await this.formatContent(updatedDocument.uri, content)
		}
		// const formatedContent = await this.formatContent(updatedDocument.uri, content)
		await this.applyUpdate(content)
		this.logger(`[${Date.now()}] final update applied - waiting for change to apply`, "info")
		await changePromise
		this.logger(`[${Date.now()}] final update change applied`, "info")
		this.activeLineController?.clear()
		this.fadedOverlayController?.clear()
	}

	private scheduleUpdate(): void {
		if (this.updateScheduled || this.isFinalReached) {
			return
		}

		this.updateScheduled = true

		setTimeout(async () => {
			process.nextTick(async () => {
				await this.applyPendingUpdate()
				this.updateScheduled = false
			})
		}, CONSTANTS.UPDATE_BATCH_INTERVAL)
	}

	private async applyPendingUpdate(): Promise<void> {
		if (!this.validateEditorState() || !this.pendingContent) {
			return
		}

		const content = this.pendingContent
		if (content === this.previousContent) {
			return
		}

		const newLines = content.split(/\r?\n/)
		await this.updateContent(newLines)
		await this.updateUIElements(newLines)
		await this.handleScrolling()

		this.previousContent = content
	}

	private async updateContent(newLines: string[]): Promise<void> {
		const updatedContent = this.computeUpdatedContent(newLines)
		await this.writeContent(this.modifiedUri!, updatedContent)
		this.streamedContent = updatedContent
	}

	private computeUpdatedContent(newLines: string[]): string {
		const currentLines = this.previousContent.split(/\r?\n/)
		let lastModifiedLine = 0

		for (let i = 0; i < newLines.length; i++) {
			if (i >= currentLines.length || newLines[i] !== currentLines[i]) {
				lastModifiedLine = i
			}
		}

		this.lastModifiedLine = lastModifiedLine
		return newLines.join("\n")
	}

	private async updateUIElements(newLines: string[]): Promise<void> {
		if (this.activeLineController && this.fadedOverlayController) {
			this.activeLineController.setActiveLine(this.lastModifiedLine)
			this.fadedOverlayController.updateOverlayAfterLine(
				this.lastModifiedLine,
				this.diffEditor!.document.lineCount
			)
		}
	}

	private async handleScrolling(): Promise<void> {
		const now = Date.now()
		if (
			this.isAutoScrollEnabled &&
			this.shouldScroll(now) &&
			(this.isUserInteractionTimeout(now) || this.checkScrollPosition())
		) {
			await this.scrollToModifiedLine()
			this.lastScrollTime = now
		}
	}

	private shouldScroll(now: number): boolean {
		return now - this.lastScrollTime >= CONSTANTS.SCROLL_THROTTLE
	}

	private isUserInteractionTimeout(now: number): boolean {
		return now - this.lastUserInteraction >= CONSTANTS.USER_INTERACTION_TIMEOUT
	}

	private async applyUpdate(content: string): Promise<void> {
		if (!this.diffEditor || !this.modifiedUri) {
			return
		}

		try {
			// Add logging for better debugging
			this.logger(`Applying update: content length ${content.length}`, "info")

			// Update content with proper encoding
			DiffViewProvider.modifiedContentProvider.writeFile(this.modifiedUri, new TextEncoder().encode(content), {
				create: false,
				overwrite: true,
			})

			this.streamedContent = content

			// Handle scrolling behavior (disabled for testing)
			// await this.handleScrollBehavior()
		} catch (error) {
			this.logger(`Failed to apply update: ${error}`, "error")
			throw new DiffViewError(`Failed to apply update: ${error}`)
		}
	}

	private async formatDocument(uri: vscode.Uri) {
		try {
			// Verify document exists and has content
			const document = await vscode.workspace.openTextDocument(uri)
			if (!document || document.getText().length === 0) {
				return null
			}

			const formatEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
				"vscode.executeFormatDocumentProvider",
				uri,
				{ tabSize: 4, insertSpaces: true }
			)

			return formatEdits || [] // Return empty array instead of undefined
		} catch (error) {
			console.error("Format failed:", error)
			return null
		}
	}

	private async formatContent(uri: vscode.Uri, content: string): Promise<string> {
		const formatEdits = await this.formatDocument(uri)

		if (formatEdits && formatEdits?.length > 0) {
			// Apply the formatting edits to the content
			const formattedContent = this.applyTextEdits(content, formatEdits)
			return formattedContent
		}

		// If no formatter is available or no edits, return the original content
		return content
	}

	private offsetAt(position: vscode.Position, content: string): number {
		const lines = content.split(/\r?\n/)

		// Validate line number
		if (position.line >= lines.length) {
			// If position is beyond content, return the end of content
			return content.length
		}

		let offset = 0
		for (let i = 0; i < position.line; i++) {
			offset += lines[i].length + 1 // +1 for newline
		}

		// Validate character position
		const maxCharacter = lines[position.line].length
		const character = Math.min(position.character, maxCharacter)
		offset += character

		return offset
	}

	private applyTextEdits(content: string, edits: vscode.TextEdit[]): string {
		if (!edits?.length) {
			return content
		}

		// Sort edits in reverse order
		const sortedEdits = edits.sort((a, b) => {
			const aStart = a.range.start.line * 1e6 + a.range.start.character
			const bStart = b.range.start.line * 1e6 + b.range.start.character
			return bStart - aStart
		})

		let formattedContent = content

		for (const edit of sortedEdits) {
			const startOffset = this.offsetAt(edit.range.start, formattedContent)
			const endOffset = this.offsetAt(edit.range.end, formattedContent)
			formattedContent =
				formattedContent.substring(0, startOffset) + edit.newText + formattedContent.substring(endOffset)
		}

		return formattedContent
	}

	private async handleScrollBehavior(): Promise<void> {
		const now = Date.now()
		if (
			this.isAutoScrollEnabled &&
			now - this.lastScrollTime >= CONSTANTS.SCROLL_THROTTLE &&
			(now - this.lastUserInteraction >= CONSTANTS.USER_INTERACTION_TIMEOUT || this.checkScrollPosition())
		) {
			await this.scrollToBottom()
			this.lastScrollTime = now
		}
	}

	private async scrollToModifiedLine(): Promise<void> {
		if (!this.diffEditor) {
			return
		}

		const totalLines = this.diffEditor.document.lineCount
		if (totalLines === 0) {
			return
		}

		const line = Math.min(Math.max(0, this.lastModifiedLine), totalLines - 1)
		const range = new vscode.Range(line, 0, line, this.diffEditor.document.lineAt(line).text.length)
		this.diffEditor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
	}

	private async scrollToBottom(): Promise<void> {
		if (!this.diffEditor) {
			return
		}

		const lastLine = this.diffEditor.document.lineCount - 1
		const lastCharacter = this.diffEditor.document.lineAt(lastLine).text.length
		const range = new vscode.Range(lastLine, lastCharacter, lastLine, lastCharacter)
		this.diffEditor.revealRange(range, vscode.TextEditorRevealType.Default)
	}

	private checkScrollPosition(): boolean {
		if (!this.diffEditor) {
			return false
		}

		const visibleRanges = this.diffEditor.visibleRanges
		if (visibleRanges.length === 0) {
			return false
		}

		const lastVisibleLine = visibleRanges[visibleRanges.length - 1].end.line
		const firstVisibleLine = visibleRanges[0].start.line
		return (
			this.lastModifiedLine >= firstVisibleLine - CONSTANTS.SCROLL_THRESHOLD &&
			this.lastModifiedLine <= lastVisibleLine + CONSTANTS.SCROLL_THRESHOLD
		)
	}

	public async revertChanges(): Promise<void> {
		if (!this.relPath) {
			return
		}

		this.disposables.forEach((d) => d.dispose())
		await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor")

		if (this.originalContent === "") {
			const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))
			try {
				await vscode.workspace.fs.delete(uri)
			} catch (error) {
				this.logger(`Failed to delete new file: ${error}`, "error")
			}
		}

		this.isEditing = false
		await this.reset()
	}

	private async reset(): Promise<void> {
		if (this.modifiedUri) {
			try {
				DiffViewProvider.modifiedContentProvider.delete(this.modifiedUri)
			} catch (error) {
				// Ignore deletion errors
			}
		}
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout)
			this.updateTimeout = null
		}
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
		this.diffEditor = undefined
		this.streamedContent = ""
		this.lastEditPosition = undefined
		this.lastScrollTime = 0
		this.isFinalReached = false
		this.isAutoScrollEnabled = true
		this.lastUserInteraction = 0
		this.activeLineController = undefined
		this.fadedOverlayController = undefined
		this.previousContent = ""
		this.pendingContent = ""
		this.updateScheduled = false
	}

	public async saveChanges(): Promise<{ userEdits: string | undefined; finalContent: string }> {
		try {
			if (!this.relPath) {
				throw new DiffViewError("No file path set")
			}

			if (!this.diffEditor || this.diffEditor.document.isClosed) {
				throw new DiffViewError("Diff editor is not initialized or has been closed")
			}

			const updatedDocument = this.diffEditor.document
			// Format the edited content before saving
			let editedContent = updatedDocument.getText()
			const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))

			await createDirectoriesForFile(uri.fsPath)

			try {
				const doc = await vscode.workspace.openTextDocument(uri)
				if (doc.isDirty) {
					await doc.save()
				}
				const editor = await vscode.window.showTextDocument(doc)
				await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
			} catch (e) {
				this.logger(
					`While saving to doc encountered a doc that is non existent meaning it's a new file`,
					"warn"
				)
			}

			await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(editedContent))
			await vscode.workspace.save(uri)

			// Close diff views
			await this.closeAllDiffViews()

			// open document again
			await vscode.window.showTextDocument(uri)

			const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
			const normalizedStreamedContent = this.streamedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"

			if (normalizedEditedContent !== normalizedStreamedContent) {
				const userEdits = await this.createPrettyPatch(
					this.relPath.replace(/\\/g, "/"),
					normalizedStreamedContent,
					normalizedEditedContent
				)
				return { userEdits, finalContent: normalizedEditedContent }
			}

			return { userEdits: undefined, finalContent: normalizedEditedContent }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logger(`Failed to save changes: ${errorMessage}`, "error")
			throw new DiffViewError(`Failed to save changes: ${errorMessage}`)
		}
	}

	private async createPrettyPatch(filename: string, oldStr: string, newStr: string): Promise<string> {
		const patch = diff.createPatch(filename, oldStr, newStr)
		const lines = patch.split("\n")
		return lines.slice(4).join("\n")
	}

	public isDiffViewOpen(): boolean {
		return !!this.diffEditor && !this.diffEditor.document.isClosed
	}

	private async closeAllDiffViews() {
		const tabs = vscode.window.tabGroups.all
			.flatMap((tg) => tg.tabs)
			.filter(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff &&
					(tab.input?.original?.scheme === CONSTANTS.DIFF_VIEW_URI_SCHEME ||
						tab.input?.modified?.scheme === CONSTANTS.MODIFIED_URI_SCHEME)
			)
		for (const tab of tabs) {
			if (!tab.isDirty) {
				await vscode.window.tabGroups.close(tab)
			}
		}
	}
}

export { DecorationController, ModifiedContentProvider, DiffViewProvider }
