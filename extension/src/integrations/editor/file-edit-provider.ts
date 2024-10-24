/**
 * THIS FILE WAS CREATED BY KODU.AI v1.9.19 - https://kodu.ai/
 * THIS LETS KODU STREAM CONTENT TO MEMORY WITH VISUAL FEEDBACK
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

export class FileEditProvider {
	private editor?: vscode.TextEditor
	private originalContent: string = ""
	private memoryContent: string = ""
	public isEditing: boolean = false
	private relPath?: string
	private koduDev: KoduDev
	private updateTimeout: NodeJS.Timeout | null = null
	private currentLine: number = 0
	private disposables: vscode.Disposable[] = []
	private static modifiedContentProvider: ModifiedContentProvider
	private lastScrollTime: number = 0
	private isAutoScrollEnabled: boolean = true
	private lastUserInteraction: number = 0
	private static readonly SCROLL_THROTTLE = 100 // ms
	private static readonly USER_INTERACTION_TIMEOUT = 1000 // ms
	private static readonly SCROLL_THRESHOLD = 6 // lines from editing line
	private static readonly REVEAL_RANGE = 3 // lines to reveal around editing line

	private readonly overlayDecoration = vscode.window.createTextEditorDecorationType({
		backgroundColor: "rgba(255, 255, 0, 0.1)",
		opacity: "0.4",
		isWholeLine: true,
	})

	private readonly activeLineDecoration = vscode.window.createTextEditorDecorationType({
		backgroundColor: "rgba(255, 255, 0, 0.3)",
		opacity: "1",
		isWholeLine: true,
		border: "1px solid rgba(255, 255, 0, 0.5)",
	})

	constructor(private cwd: string, koduDev: KoduDev, private updateInterval: number = 16) {
		this.koduDev = koduDev

		if (!FileEditProvider.modifiedContentProvider) {
			FileEditProvider.modifiedContentProvider = new ModifiedContentProvider()
			vscode.workspace.registerFileSystemProvider(MODIFIED_URI_SCHEME, FileEditProvider.modifiedContentProvider)
		}
	}

	public async open(relPath: string): Promise<void> {
		this.isEditing = true
		this.relPath = relPath
		this.isAutoScrollEnabled = true
		const absolutePath = path.resolve(this.cwd, relPath)

		try {
			this.originalContent = await fs.readFile(absolutePath, "utf-8")
			this.memoryContent = this.originalContent
		} catch (error) {
			this.originalContent = ""
			this.memoryContent = ""
		}

		await this.openEditor()
		this.setupEventListeners()
	}

	private checkScrollPosition(): boolean {
		if (!this.editor) return false

		const visibleRanges = this.editor.visibleRanges
		if (visibleRanges.length === 0) return false

		const lastVisibleLine = visibleRanges[visibleRanges.length - 1].end.line
		const firstVisibleLine = visibleRanges[0].start.line

		// Check if editing line is within visible range + threshold
		return (
			Math.abs(this.currentLine - lastVisibleLine) <= FileEditProvider.SCROLL_THRESHOLD ||
			Math.abs(this.currentLine - firstVisibleLine) <= FileEditProvider.SCROLL_THRESHOLD
		)
	}

	private setupEventListeners(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []

		if (this.editor) {
			this.disposables.push(
				vscode.window.onDidChangeTextEditorSelection((e) => {
					if (e.textEditor === this.editor) {
						this.lastUserInteraction = Date.now()
						this.isAutoScrollEnabled = false
					}
				}),
				vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
					if (e.textEditor === this.editor) {
						const now = Date.now()
						if (now - this.lastScrollTime > FileEditProvider.SCROLL_THROTTLE) {
							if (this.checkScrollPosition()) {
								this.isAutoScrollEnabled = true
								this.lastUserInteraction = 0
							} else {
								if (
									this.isAutoScrollEnabled &&
									now - this.lastUserInteraction < FileEditProvider.USER_INTERACTION_TIMEOUT
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

	private async openEditor(): Promise<void> {
		if (!this.relPath) return

		const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))

		try {
			const document = await vscode.workspace.openTextDocument(uri)
			this.editor = await vscode.window.showTextDocument(document, {
				preview: false,
				preserveFocus: true,
			})

			// Initialize with original content
			await this.editor.edit((editBuilder) => {
				const fullRange = new vscode.Range(
					0,
					0,
					this.editor!.document.lineCount - 1,
					this.editor!.document.lineAt(this.editor!.document.lineCount - 1).text.length
				)
				editBuilder.replace(fullRange, this.originalContent)
			})

			this.setupDecorations()
		} catch (error) {
			// If file doesn't exist, create it
			await fs.writeFile(uri.fsPath, this.originalContent)
			const document = await vscode.workspace.openTextDocument(uri)
			this.editor = await vscode.window.showTextDocument(document, {
				preview: false,
				preserveFocus: true,
			})
			this.setupDecorations()
		}
	}

	private setupDecorations(): void {
		if (!this.editor) return

		const totalLines = this.editor.document.lineCount
		if (totalLines > 0) {
			const overlayRange = new vscode.Range(
				0,
				0,
				totalLines - 1,
				this.editor.document.lineAt(totalLines - 1).text.length
			)
			this.editor.setDecorations(this.overlayDecoration, [overlayRange])
		}
	}

	private async revealEditingLine(): Promise<void> {
		if (!this.editor) return

		const startLine = Math.max(0, this.currentLine - FileEditProvider.REVEAL_RANGE)
		const endLine = Math.min(this.editor.document.lineCount - 1, this.currentLine + FileEditProvider.REVEAL_RANGE)

		const range = new vscode.Range(startLine, 0, endLine, 0)
		this.editor.revealRange(range, vscode.TextEditorRevealType.InCenter)
	}

	public async update(accumulatedContent: string, isFinal: boolean): Promise<void> {
		if (!this.editor) {
			throw new Error("Editor not initialized")
		}

		if (isFinal) {
			if (this.updateTimeout) {
				clearTimeout(this.updateTimeout)
				this.updateTimeout = null
			}
			await this.applyUpdate(accumulatedContent)
			await this.showFinalDiff()
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
		if (!this.editor) return

		const newLines = content.split("\n")
		const currentLines = this.memoryContent.split("\n")

		// Find the first line that differs
		let diffIndex = 0
		while (diffIndex < currentLines.length && diffIndex < newLines.length) {
			if (currentLines[diffIndex] !== newLines[diffIndex]) break
			diffIndex++
		}

		// Update content
		if (diffIndex < newLines.length) {
			this.currentLine = diffIndex
			await this.editor.edit((editBuilder) => {
				const line = newLines[diffIndex]
				if (diffIndex >= this.editor!.document.lineCount) {
					const lastLine = this.editor!.document.lineCount - 1
					const lastLineText = this.editor!.document.lineAt(lastLine).text
					editBuilder.insert(new vscode.Position(lastLine, lastLineText.length), "\n" + line)
				} else {
					const range = this.editor!.document.lineAt(diffIndex).range
					editBuilder.replace(range, line)
				}
			})

			// Highlight current line
			const activeLine = new vscode.Range(diffIndex, 0, diffIndex, newLines[diffIndex].length)
			this.editor.setDecorations(this.activeLineDecoration, [activeLine])

			// Update overlay for remaining lines
			if (diffIndex < this.editor.document.lineCount - 1) {
				const overlayRange = new vscode.Range(
					diffIndex + 1,
					0,
					this.editor.document.lineCount - 1,
					this.editor.document.lineAt(this.editor.document.lineCount - 1).text.length
				)
				this.editor.setDecorations(this.overlayDecoration, [overlayRange])
			}

			// Handle scrolling
			const now = Date.now()
			if (
				this.isAutoScrollEnabled &&
				now - this.lastScrollTime >= FileEditProvider.SCROLL_THROTTLE &&
				(now - this.lastUserInteraction >= FileEditProvider.USER_INTERACTION_TIMEOUT ||
					this.checkScrollPosition())
			) {
				await this.revealEditingLine()
				this.lastScrollTime = now
			}
		}

		this.memoryContent = content
	}

	private async showFinalDiff(): Promise<void> {
		if (!this.relPath || !this.editor) return

		// Clear decorations
		this.editor.setDecorations(this.activeLineDecoration, [])
		this.editor.setDecorations(this.overlayDecoration, [])

		const fileName = path.basename(this.relPath)

		// Create URIs for diff view
		const originalUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
			query: Buffer.from(this.originalContent).toString("base64"),
		})

		const modifiedUri = vscode.Uri.parse(`${MODIFIED_URI_SCHEME}:/${fileName}`).with({
			query: Buffer.from(this.memoryContent).toString("base64"),
		})

		// Register content provider for the modified content
		FileEditProvider.modifiedContentProvider.writeFile(modifiedUri, Buffer.from(this.memoryContent), {
			create: true,
			overwrite: true,
		})

		// Close the editor without saving
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor")

		// Show diff view
		await vscode.commands.executeCommand("vscode.diff", originalUri, modifiedUri, `${fileName}: Review Changes`)
	}

	public async revertChanges(): Promise<void> {
		if (!this.relPath) return

		this.disposables.forEach((d) => d.dispose())

		if (this.editor) {
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
		}

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
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout)
			this.updateTimeout = null
		}

		if (this.editor) {
			this.editor.setDecorations(this.activeLineDecoration, [])
			this.editor.setDecorations(this.overlayDecoration, [])
		}

		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
		this.editor = undefined
		this.memoryContent = ""
		this.currentLine = 0
		this.lastScrollTime = 0
		this.isAutoScrollEnabled = true
		this.lastUserInteraction = 0
	}

	public async acceptChanges(): Promise<void> {
		if (!this.relPath) {
			throw new Error("No file path set")
		}

		const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))
		await createDirectoriesForFile(uri.fsPath)
		await vscode.workspace.fs.writeFile(uri, Buffer.from(this.memoryContent))

		this.isEditing = false
		if (this.editor) {
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
		}
	}

	public async saveChanges(): Promise<{ userEdits: string | undefined }> {
		try {
			if (!this.relPath) {
				throw new Error("No file path set")
			}

			const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))
			await createDirectoriesForFile(uri.fsPath)
			await vscode.workspace.fs.writeFile(uri, Buffer.from(this.memoryContent))

			const normalizedMemoryContent = this.memoryContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
			const normalizedOriginalContent = this.originalContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"

			if (normalizedMemoryContent !== normalizedOriginalContent) {
				const userEdits = await this.createPrettyPatch(
					this.relPath.replace(/\\/g, "/"),
					normalizedOriginalContent,
					normalizedMemoryContent
				)
				return { userEdits }
			}

			return { userEdits: undefined }
		} catch (error) {
			throw new Error(`Failed to save changes: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	private async createPrettyPatch(filename: string, oldStr: string, newStr: string): Promise<string> {
		const patch = diff.createPatch(filename, oldStr, newStr)
		const lines = patch.split("\n")
		return lines.slice(4).join("\n")
	}

	public isDiffViewOpen(): boolean {
		return !!this.editor && !this.editor.document.isClosed
	}
}
