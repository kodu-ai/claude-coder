/**
 * THIS FILE WAS CREATED BY KODU.AI v1.9.19 - https://kodu.ai/
 * THIS LETS KODU STREAM DIFF IN MEMORY AND SHOW IT IN VS CODE
 * ALSO IT UPDATES THE WORKSPACE TIMELINE WITH THE CHANGES
 */
import * as diff from "diff"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { KoduDev } from "../../agent/v1"
import { createDirectoriesForFile } from "../../utils/fs"

// Constants
export const CONSTANTS = {
	DIFF_VIEW_URI_SCHEME: "claude-coder-diff",
	MODIFIED_URI_SCHEME: "claude-coder-modified",
	UPDATE_BATCH_INTERVAL: 32,
} as const

interface DocumentState {
	uri: string
	originalContent: string
	currentContent: string
	isFinal: boolean
	isNewFile: boolean
}

// Add this class before DiffViewProvider
class ModifiedContentProvider implements vscode.FileSystemProvider {
	private content = new Map<string, Uint8Array>()
	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>()
	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event

	watch(): vscode.Disposable {
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
	private currentDocumentState?: DocumentState
	private diffEditor?: vscode.TextEditor
	private disposables: vscode.Disposable[] = []
	private static modifiedContentProvider: ModifiedContentProvider
	private originalUri?: vscode.Uri
	private modifiedUri?: vscode.Uri
	private updateTimeout: NodeJS.Timeout | null = null

	constructor(private cwd: string, koduDev: KoduDev) {
		if (!DiffViewProvider.modifiedContentProvider) {
			DiffViewProvider.modifiedContentProvider = new ModifiedContentProvider()
			try {
				vscode.workspace.registerFileSystemProvider(
					CONSTANTS.MODIFIED_URI_SCHEME,
					DiffViewProvider.modifiedContentProvider
				)
			} catch (e) {
				console.error(`Failed to register file system provider: ${e}`)
				throw new Error(`Failed to register file system provider: ${e}`)
			}
		}
	}

	public async open(relPath: string): Promise<boolean> {
		try {
			const absolutePath = path.resolve(this.cwd, relPath)
			let originalContent: string
			let isNewFile = false
			
			try {
				originalContent = await fs.readFile(absolutePath, "utf-8")
			} catch (error) {
				console.log("Creating new file")
				originalContent = ""
				isNewFile = true
			}

			this.currentDocumentState = {
				uri: absolutePath,
				originalContent,
				currentContent: originalContent,
				isFinal: false,
				isNewFile
			}

			await this.openDiffEditor(relPath)

			// Wait for editor to be ready
			await new Promise<void>((resolve) => {
				const interval = setInterval(() => {
					if (this.diffEditor) {
						clearInterval(interval)
						resolve()
					}
				}, 100)
			})

			return true
		} catch (error) {
			console.error("Failed to open document:", error)
			return false
		}
	}

	private async openDiffEditor(relPath: string): Promise<void> {
		if (!this.currentDocumentState) return

		const absoluteFilePath = path.resolve(this.cwd, relPath)
		const fileName = path.basename(absoluteFilePath)
		const fileUri = vscode.Uri.file(absoluteFilePath)

		// For new files, use empty content for both sides to prevent green highlighting
		const leftContent = this.currentDocumentState.isNewFile ? "" : this.currentDocumentState.originalContent

		this.originalUri = fileUri.with({
			scheme: CONSTANTS.DIFF_VIEW_URI_SCHEME,
			query: Buffer.from(leftContent).toString("base64"),
		})

		this.modifiedUri = fileUri.with({
			scheme: CONSTANTS.MODIFIED_URI_SCHEME,
		})

		DiffViewProvider.modifiedContentProvider.writeFile(
			this.modifiedUri,
			new TextEncoder().encode(this.currentDocumentState.originalContent),
			{ create: true, overwrite: true }
		)

		await vscode.commands.executeCommand(
			"vscode.diff",
			this.originalUri,
			this.modifiedUri,
			`${fileName}: ${this.currentDocumentState.isNewFile ? "New File" : "Original ↔ Kodu's Changes"} (Editable)`,
			{ preview: false, preserveFocus: true }
		)

		const editor = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.toString() === this.modifiedUri!.toString()
		)
		if (editor) {
			this.diffEditor = editor
			this.setupEventListeners()
		}
	}

	private setupEventListeners(): void {
		this.disposables.forEach(d => d.dispose())
		this.disposables = []

		if (this.diffEditor) {
			// Add any necessary event listeners
			this.disposables.push(
				vscode.workspace.onDidChangeTextDocument(e => {
					if (e.document === this.diffEditor?.document) {
						this.currentDocumentState!.currentContent = e.document.getText()
					}
				})
			)
		}
	}

	public async update(content: string, isFinal: boolean): Promise<void> {
		if (!this.currentDocumentState || !this.modifiedUri || !this.diffEditor) {
			return
		}

		if (this.currentDocumentState.isFinal) {
			console.warn("Ignoring update - final state already reached")
			return
		}

		try {
			if (isFinal) {
				await this.handleFinalUpdate(content)
				return
			}

			// Throttle updates
			if (this.updateTimeout) {
				clearTimeout(this.updateTimeout)
			}

			this.updateTimeout = setTimeout(async () => {
				try {
					await this.applyUpdate(content)
				} catch (error) {
					console.error("Failed to apply update:", error)
				}
			}, CONSTANTS.UPDATE_BATCH_INTERVAL)
		} catch (error) {
			console.error("Error in update:", error)
		}
	}

	private async handleFinalUpdate(content: string): Promise<void> {
		if (!this.diffEditor || !this.modifiedUri) return

		const updatedDocument = this.diffEditor.document
		const isPython = updatedDocument.languageId === "python" ||
			updatedDocument.languageId === "python2" ||
			updatedDocument.languageId === "python3" ||
			updatedDocument.languageId === "jupyter" ||
			updatedDocument.languageId === "jupyter-notebook"

		if (isPython) {
			content = await this.formatContent(updatedDocument.uri, content)
		}

		await this.applyUpdate(content)
		this.currentDocumentState!.isFinal = true
	}

	private async applyUpdate(content: string): Promise<void> {
		if (!this.modifiedUri) return

		try {
			DiffViewProvider.modifiedContentProvider.writeFile(
				this.modifiedUri,
				new TextEncoder().encode(content),
				{ create: false, overwrite: true }
			)
			this.currentDocumentState!.currentContent = content
		} catch (error) {
			console.error("Failed to apply update:", error)
		}
	}

	// Format helpers from original implementation
	private async formatDocument(uri: vscode.Uri) {
		try {
			const document = await vscode.workspace.openTextDocument(uri)
			if (!document || document.getText().length === 0) {
				return null
			}

			return await vscode.commands.executeCommand<vscode.TextEdit[]>(
				"vscode.executeFormatDocumentProvider",
				uri,
				{ tabSize: 4, insertSpaces: true }
			) || []
		} catch (error) {
			console.error("Format failed:", error)
			return null
		}
	}

	private async formatContent(uri: vscode.Uri, content: string): Promise<string> {
		const formatEdits = await this.formatDocument(uri)
		if (formatEdits && formatEdits.length > 0) {
			return this.applyTextEdits(content, formatEdits)
		}
		return content
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

	private offsetAt(position: vscode.Position, content: string): number {
		const lines = content.split(/\r?\n/)
		if (position.line >= lines.length) {
			return content.length
		}

		let offset = 0
		for (let i = 0; i < position.line; i++) {
			offset += lines[i].length + 1 // +1 for newline
		}

		const maxCharacter = lines[position.line].length
		const character = Math.min(position.character, maxCharacter)
		offset += character

		return offset
	}

	public async revertChanges(): Promise<void> {
		if (!this.currentDocumentState) return

		this.disposables.forEach(d => d.dispose())
		await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor")

		if (this.currentDocumentState.originalContent === "") {
			const uri = vscode.Uri.file(this.currentDocumentState.uri)
			try {
				await vscode.workspace.fs.delete(uri)
			} catch (error) {
				console.error("Failed to delete new file:", error)
			}
		}

		await this.dispose()
	}

	public async saveChanges(): Promise<{ userEdits: string | undefined; finalContent: string }> {
		if (!this.currentDocumentState || !this.diffEditor) {
			throw new Error("No active document")
		}

		try {
			const editedContent = this.diffEditor.document.getText()
			const uri = vscode.Uri.file(this.currentDocumentState.uri)

			await createDirectoriesForFile(uri.fsPath)
			await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(editedContent))

			const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
			const normalizedStreamedContent = this.currentDocumentState.currentContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"

			let userEdits: string | undefined
			if (normalizedEditedContent !== normalizedStreamedContent) {
				userEdits = await this.createPrettyPatch(
					path.relative(this.cwd, uri.fsPath).replace(/\\/g, "/"),
					normalizedStreamedContent,
					normalizedEditedContent
				)
			}

			await this.closeAllDiffViews()
			return { userEdits, finalContent: normalizedEditedContent }
		} catch (error) {
			console.error("Failed to save changes:", error)
			throw error
		}
	}

	private async createPrettyPatch(filename: string, oldStr: string, newStr: string): Promise<string> {
		const patch = diff.createPatch(filename, oldStr, newStr)
		return patch.split("\n").slice(4).join("\n")
	}

	private async closeAllDiffViews() {
		const tabs = vscode.window.tabGroups.all
			.flatMap(tg => tg.tabs)
			.filter(tab =>
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

	public isDiffViewOpen(): boolean {
		return !!this.diffEditor && !this.diffEditor.document.isClosed
	}

	private async dispose() {
		this.disposables.forEach(d => d.dispose())
		this.disposables = []

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

		this.diffEditor = undefined
		this.currentDocumentState = undefined
		this.originalUri = undefined
		this.modifiedUri = undefined
	}
}

export { DiffViewProvider }
