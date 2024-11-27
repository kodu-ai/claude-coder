import * as diff from "diff"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { KoduDev } from "../../agent/v1"
import { createDirectoriesForFile } from "../../utils/fs"

export const CONSTANTS = {
	DIFF_VIEW_URI_SCHEME: "claude-coder-diff",
	MODIFIED_URI_SCHEME: "claude-coder-modified",
	UPDATE_BATCH_INTERVAL: 32,
} as const

interface EditBlock {
	id: string
	searchContent: string
	currentContent: string
	finalContent?: string
	status: "pending" | "streaming" | "final"
}

interface DocumentState {
	uri: string
	originalContent: string
	currentContent: string
	editBlocks: Map<string, EditBlock>
	isFinal: boolean
	isNewFile: boolean
}

class DiffContentProvider implements vscode.TextDocumentContentProvider {
	private _onDidChange = new vscode.EventEmitter<vscode.Uri>()
	onDidChange = this._onDidChange.event
	private contents = new Map<string, string>()

	provideTextDocumentContent(uri: vscode.Uri): string {
		return this.contents.get(uri.toString()) || ''
	}

	update(uri: vscode.Uri, content: string) {
		this.contents.set(uri.toString(), content)
		this._onDidChange.fire(uri)
	}

	delete(uri: vscode.Uri) {
		this.contents.delete(uri.toString())
	}
}

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
	}

	rename(): void {
		throw new Error("Not implemented")
	}

	readDirectory(): [string, vscode.FileType][] {
		return []
	}

	createDirectory(): void {
		throw new Error("Not implemented")
	}
}

export class FullFileEditor {
	private currentDocumentState: DocumentState | undefined
	private diffEditor?: vscode.TextEditor
	private disposables: vscode.Disposable[] = []
	private static modifiedContentProvider: ModifiedContentProvider
	private static diffContentProvider: DiffContentProvider
	private originalUri?: vscode.Uri
	private modifiedUri?: vscode.Uri
	private updateTimeout: NodeJS.Timeout | null = null
	private static providersRegistered = false

	constructor(private cwd: string, koduDev: KoduDev) {
		if (!FullFileEditor.providersRegistered) {
			if (!FullFileEditor.diffContentProvider) {
				FullFileEditor.diffContentProvider = new DiffContentProvider()
				vscode.workspace.registerTextDocumentContentProvider(
					CONSTANTS.DIFF_VIEW_URI_SCHEME,
					FullFileEditor.diffContentProvider
				)
			}

			if (!FullFileEditor.modifiedContentProvider) {
				FullFileEditor.modifiedContentProvider = new ModifiedContentProvider()
				try {
					vscode.workspace.registerFileSystemProvider(
						CONSTANTS.MODIFIED_URI_SCHEME,
						FullFileEditor.modifiedContentProvider,
						{ isCaseSensitive: true }
					)
				} catch (e) {
					// If provider is already registered, just use the existing one
					if (!(e instanceof Error) || !e.message.includes('already registered')) {
						console.error(`Failed to register file system provider: ${e}`)
						throw new Error(`Failed to register file system provider: ${e}`)
					}
				}
			}
			FullFileEditor.providersRegistered = true
		}
	}

	public async open(id: string, filePath: string, searchContent: string): Promise<boolean> {
		try {
			const absolutePath = path.resolve(this.cwd, filePath)
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
				editBlocks: new Map(),
				isFinal: false,
				isNewFile
			}

			// Add initial block
			this.currentDocumentState.editBlocks.set(id, {
				id,
				searchContent,
				currentContent: searchContent,
				status: "pending",
			})

			// Open document for editing
			const document = await vscode.workspace.openTextDocument(absolutePath)
			await vscode.window.showTextDocument(document, {
				viewColumn: vscode.ViewColumn.Active,
				preserveFocus: false,
				preview: false,
			})

			return true
		} catch (error) {
			console.error("Failed to open document:", error)
			return false
		}
	}

	public async applyStreamContent(id: string, searchContent: string, content: string): Promise<boolean> {
		if (!this.currentDocumentState) {
			return false
		}

		try {
			let block = this.currentDocumentState.editBlocks.get(id)
			if (!block) {
				block = {
					id,
					searchContent,
					currentContent: searchContent,
					status: "pending",
				}
				this.currentDocumentState.editBlocks.set(id, block)
			}

			// Only update the in-memory content without saving to file
			block.currentContent = content
			block.status = "streaming"
			this.currentDocumentState.currentContent = content

			return true
		} catch (error) {
			console.error("Failed to apply streaming content:", error)
			return false
		}
	}

	public async applyFinalContent(id: string, searchContent: string, content: string): Promise<boolean> {
		if (!this.currentDocumentState) {
			return false
		}

		const block = this.currentDocumentState.editBlocks.get(id)
		if (!block) {
			return false
		}

		block.finalContent = content
		block.status = "final"
		this.currentDocumentState.currentContent = content
		this.currentDocumentState.isFinal = true

		// Only open diff view when content is final
		if (this.currentDocumentState.isFinal) {
			await this.openDiffEditor()
		}
		
		return true
	}

	private async openDiffEditor(): Promise<void> {
		if (!this.currentDocumentState) return

		const fileName = path.basename(this.currentDocumentState.uri)
		const fileUri = vscode.Uri.file(this.currentDocumentState.uri)

		this.originalUri = fileUri.with({
			scheme: CONSTANTS.DIFF_VIEW_URI_SCHEME,
			path: this.currentDocumentState.uri
		})

		this.modifiedUri = fileUri.with({
			scheme: CONSTANTS.MODIFIED_URI_SCHEME,
		})

		const leftContent = this.currentDocumentState.isNewFile ? "" : this.currentDocumentState.originalContent

		FullFileEditor.diffContentProvider.update(this.originalUri, leftContent)
		FullFileEditor.modifiedContentProvider.writeFile(
			this.modifiedUri,
			new TextEncoder().encode(this.currentDocumentState.currentContent),
			{ create: true, overwrite: true }
		)

		await vscode.commands.executeCommand(
			"vscode.diff",
			this.originalUri,
			this.modifiedUri,
			`${fileName}: ${this.currentDocumentState.isNewFile ? "New File" : "Original ↔ Changes"} (Editable)`,
			{ preview: false }
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
			this.disposables.push(
				vscode.workspace.onDidChangeTextDocument(e => {
					if (e.document === this.diffEditor?.document) {
					this.currentDocumentState!.currentContent = e.document.getText()
					}
				})
			)
		}
	}

	public async saveChanges(): Promise<{ userEdits?: string; finalContent: string }> {
		if (!this.currentDocumentState) {
			throw new Error("No active document")
		}

		try {
			const editedContent = this.diffEditor ? 
				this.diffEditor.document.getText() : 
				this.currentDocumentState.currentContent

			const uri = vscode.Uri.file(this.currentDocumentState.uri)
			await createDirectoriesForFile(uri.fsPath)
			await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(editedContent))

			const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
			const normalizedStreamedContent = this.currentDocumentState.currentContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"

			let userEdits: string | undefined
			if (!this.currentDocumentState.isNewFile && 
				this.diffEditor && 
				normalizedEditedContent !== normalizedStreamedContent) {
				userEdits = await this.createPrettyPatch(
					path.relative(this.cwd, uri.fsPath).replace(/\\/g, "/"),
					normalizedStreamedContent,
					normalizedEditedContent
				)
			}

			await this.closeAllDiffViews()
			this.dispose()

			return { userEdits, finalContent: normalizedEditedContent }
		} catch (error) {
			console.error("Failed to save changes:", error)
			throw error
		}
	}

	public async rejectChanges(): Promise<void> {
		if (!this.currentDocumentState) return

		this.disposables.forEach(d => d.dispose())
		await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor")

		if (this.currentDocumentState.isNewFile) {
			const uri = vscode.Uri.file(this.currentDocumentState.uri)
			try {
				await vscode.workspace.fs.delete(uri)
			} catch (error) {
				console.error("Failed to delete new file:", error)
			}
		}

		await this.dispose()
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

	public isOpen(): boolean {
		return !!this.currentDocumentState
	}

	public isDiffViewOpen(): boolean {
		return !!this.diffEditor && !this.diffEditor.document.isClosed
	}

	private dispose() {
		this.disposables.forEach(d => d.dispose())
		this.disposables = []

		if (this.modifiedUri) {
			try {
				FullFileEditor.modifiedContentProvider.delete(this.modifiedUri)
			} catch (error) {
				// Ignore deletion errors
			}
		}

		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout)
			this.updateTimeout = null
		}

		if (this.originalUri) {
			FullFileEditor.diffContentProvider.delete(this.originalUri)
		}

		this.diffEditor = undefined
		this.currentDocumentState = undefined
		this.originalUri = undefined
		this.modifiedUri = undefined
	}
}
