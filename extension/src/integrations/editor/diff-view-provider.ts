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

export const DIFF_VIEW_URI_SCHEME = "claude-coder-diff"
export const MODIFIED_URI_SCHEME = "claude-coder-modified"

class ModifiedContentProvider implements vscode.FileSystemProvider {
	private content = new Map<string, Uint8Array>()
	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>()
	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event

	watch(uri: vscode.Uri): vscode.Disposable {
		return new vscode.Disposable(() => {})
	}

	stat(uri: vscode.Uri): vscode.FileStat {
		return {
			type: vscode.FileType.File,
			ctime: Date.now(),
			mtime: Date.now(),
			size: this.content.get(uri.toString())?.length || 0,
		}
	}

	readDirectory(): [string, vscode.FileType][] {
		return []
	}

	createDirectory(): void {}

	readFile(uri: vscode.Uri): Uint8Array {
		const data = this.content.get(uri.toString())
		if (!data) throw vscode.FileSystemError.FileNotFound(uri)
		return data
	}

	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
		this.content.set(uri.toString(), content)
		this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }])
	}

	delete(uri: vscode.Uri): void {
		this.content.delete(uri.toString())
		this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }])
	}

	rename(): void {
		throw vscode.FileSystemError.NoPermissions("Rename not supported")
	}
}

export class DiffViewProvider {
	private diffEditor?: vscode.TextEditor
	public originalContent: string = ""
	public streamedContent: string = ""
	public isEditing: boolean = false
	public relPath?: string
	private originalUri?: vscode.Uri
	private modifiedUri?: vscode.Uri
	private koduDev: KoduDev
	public lastEditPosition?: vscode.Position
	private updateTimeout: NodeJS.Timeout | null = null
	private lastScrollTime: number = 0
	private isAutoScrollEnabled: boolean = true
	private lastUserInteraction: number = 0
	private static readonly SCROLL_THROTTLE = 100 // ms
	private static readonly USER_INTERACTION_TIMEOUT = 1000 // ms
	private static readonly SCROLL_THRESHOLD = 10 // lines from bottom to re-enable auto-scroll
	private static modifiedContentProvider: ModifiedContentProvider
	private disposables: vscode.Disposable[] = []

	constructor(private cwd: string, koduDev: KoduDev, private updateInterval: number = 6) {
		this.koduDev = koduDev

		if (!DiffViewProvider.modifiedContentProvider) {
			DiffViewProvider.modifiedContentProvider = new ModifiedContentProvider()
			vscode.workspace.registerFileSystemProvider(MODIFIED_URI_SCHEME, DiffViewProvider.modifiedContentProvider)
		}
	}

	public async open(relPath: string): Promise<void> {
		if (this.diffEditor) {
			return
		}
		// close all open diff editors
		await this.closeAllDiffViews()
		this.isEditing = true
		this.relPath = relPath
		this.isAutoScrollEnabled = true
		const absolutePath = path.resolve(this.cwd, relPath)

		try {
			this.originalContent = await fs.readFile(absolutePath, "utf-8")
		} catch (error) {
			this.originalContent = ""
		}

		await this.openDiffEditor(relPath)
		this.setupEventListeners()
	}

	private checkScrollPosition(): boolean {
		if (!this.diffEditor) return false

		const visibleRanges = this.diffEditor.visibleRanges
		if (visibleRanges.length === 0) return false

		const lastVisibleLine = visibleRanges[visibleRanges.length - 1].end.line
		const totalLines = this.diffEditor.document.lineCount
		return totalLines - lastVisibleLine <= DiffViewProvider.SCROLL_THRESHOLD
	}

	private setupEventListeners(): void {
		// Clean up existing listeners
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []

		if (this.diffEditor) {
			// Track user interactions
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
						// Check if this is a user-initiated scroll
						if (now - this.lastScrollTime > DiffViewProvider.SCROLL_THROTTLE) {
							// If user is near bottom, re-enable auto-scroll
							if (this.checkScrollPosition()) {
								this.isAutoScrollEnabled = true
								this.lastUserInteraction = 0 // Reset interaction timer
							} else {
								// Only disable if it was recently enabled and user scrolled away
								if (
									this.isAutoScrollEnabled &&
									now - this.lastUserInteraction < DiffViewProvider.USER_INTERACTION_TIMEOUT
								) {
									this.isAutoScrollEnabled = false
								}
							}
						}
					}
				})
			)
		}
	}

	private async openDiffEditor(relPath: string): Promise<void> {
		await this.closeAllDiffViews()
		const fileName = path.basename(relPath)

		this.originalUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
			query: Buffer.from(this.originalContent).toString("base64"),
		})

		this.modifiedUri = vscode.Uri.parse(`${MODIFIED_URI_SCHEME}:/${fileName}`)
		DiffViewProvider.modifiedContentProvider.writeFile(this.modifiedUri, Buffer.from(""), {
			create: true,
			overwrite: true,
		})

		await vscode.commands.executeCommand(
			"vscode.diff",
			this.originalUri,
			this.modifiedUri,
			`${fileName}: ${this.originalContent ? "Original ↔ Kodu's Changes" : "New File"} (Editable)`
		)
		const editor = vscode.window.activeTextEditor
		if (editor && editor.document.uri.toString() === this.modifiedUri.toString()) {
			this.diffEditor = editor
		} else {
			throw new Error("Failed to open diff editor")
		}
	}

	public async update(accumulatedContent: string, isFinal: boolean): Promise<void> {
		if (!this.diffEditor || !this.modifiedUri) {
			console.warn("Diff editor not initialized")
			return
			throw new Error("Diff editor not initialized")
		}

		if (isFinal) {
			if (this.updateTimeout) {
				clearTimeout(this.updateTimeout)
				this.updateTimeout = null
			}
			await this.applyUpdate(accumulatedContent)
			await this.finalizeDiff()
			return
		}

		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout)
		}

		this.updateTimeout = setTimeout(async () => {
			await this.applyUpdate(accumulatedContent)
		}, this.updateInterval)
	}

	private async applyUpdate(content: string): Promise<void> {
		if (!this.diffEditor || !this.modifiedUri) {
			return
		}

		// Update content with proper options to maintain file history
		DiffViewProvider.modifiedContentProvider.writeFile(this.modifiedUri, Buffer.from(content), {
			create: false,
			overwrite: true,
		})
		this.streamedContent = content

		const now = Date.now()
		if (
			this.isAutoScrollEnabled &&
			now - this.lastScrollTime >= DiffViewProvider.SCROLL_THROTTLE &&
			(now - this.lastUserInteraction >= DiffViewProvider.USER_INTERACTION_TIMEOUT || this.checkScrollPosition())
		) {
			await this.scrollToBottom()
			this.lastScrollTime = now
		}
	}

	private async scrollToBottom(): Promise<void> {
		if (!this.diffEditor) return

		const lastLine = this.diffEditor.document.lineCount - 1
		const lastCharacter = this.diffEditor.document.lineAt(lastLine).text.length
		const range = new vscode.Range(lastLine, lastCharacter, lastLine, lastCharacter)

		// Use less aggressive reveal type
		this.diffEditor.revealRange(range, vscode.TextEditorRevealType.Default)
	}

	private async finalizeDiff(): Promise<void> {
		if (!this.diffEditor || !this.relPath) {
			return
		}

		await this.applyUpdate(this.streamedContent)
		this.lastEditPosition = new vscode.Position(this.diffEditor.document.lineCount - 1, 0)
		if (this.isAutoScrollEnabled) {
			await this.scrollToBottom()
		}
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
				console.error("Failed to delete new file:", error)
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
		this.isAutoScrollEnabled = true
		this.lastUserInteraction = 0
	}

	public async acceptChanges(): Promise<void> {
		if (!this.relPath) {
			throw new Error("No file path set")
		}
		if (!this.diffEditor) {
			console.warn("Diff editor not initialized")
			await this.open(this.relPath!)
		}

		const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))
		await createDirectoriesForFile(uri.fsPath)
		await vscode.workspace.fs.writeFile(uri, Buffer.from(this.streamedContent))

		// Emit file change event to update timeline
		if (DiffViewProvider.modifiedContentProvider) {
			// @ts-expect-error - this not typed in vscode
			DiffViewProvider.modifiedContentProvider._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }])
		}

		this.isEditing = false
		this.disposables.forEach((d) => d.dispose())
		await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor")
	}

	public async saveChanges(): Promise<{ userEdits: string | undefined }> {
		try {
			if (!this.relPath) {
				throw new Error("No file path set")
			}

			if (!this.diffEditor || this.diffEditor.document.isClosed) {
				throw new Error("Diff editor is not initialized or has been closed")
			}

			const updatedDocument = this.diffEditor.document
			const editedContent = updatedDocument.getText()

			const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))

			// Ensure directories exist before writing
			await createDirectoriesForFile(uri.fsPath)

			// Write file with error handling
			try {
				await vscode.workspace.fs.writeFile(uri, Buffer.from(editedContent))
			} catch (error) {
				throw new Error(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`)
			}

			// Try to open the file in editor if it's not visible
			if (
				!vscode.window.visibleTextEditors.some((editor) =>
					arePathsEqual(editor.document.uri.fsPath, uri.fsPath)
				)
			) {
				try {
					const document = await vscode.workspace.openTextDocument(uri)
					// save it to the editor
					await document.save()
					// if this is a new file, we need to
					// save it to the workspace timeline
					await vscode.window.showTextDocument(document, { preview: false })
					await vscode.workspace.save(document.uri)
				} catch (error) {
					console.warn("Could not open saved file in editor:", error)
					// Non-critical error, continue execution
				}
			}

			// Close diff views
			await this.closeAllDiffViews()

			// Compare contents and create patch if needed
			const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
			const normalizedStreamedContent = this.streamedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"

			if (normalizedEditedContent !== normalizedStreamedContent) {
				const userEdits = await this.createPrettyPatch(
					this.relPath.replace(/\\/g, "/"), // Ensure forward slashes for consistency
					normalizedStreamedContent,
					normalizedEditedContent
				)
				return { userEdits }
			}

			return { userEdits: undefined }
		} catch (error) {
			// Throw a more descriptive error
			throw new Error(`Failed to save changes: ${error instanceof Error ? error.message : String(error)}`)
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
					(tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME ||
						tab.input?.modified?.scheme === MODIFIED_URI_SCHEME)
			)
		for (const tab of tabs) {
			if (!tab.isDirty) {
				await vscode.window.tabGroups.close(tab)
			}
		}
	}
}
