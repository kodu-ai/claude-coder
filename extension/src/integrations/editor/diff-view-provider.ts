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
import { KoduDev } from "../../agent/v1"
import delay from "delay"
import pWaitFor from "p-wait-for"
import PQueue from "p-queue"
import {
	ModifiedContentProvider,
	DecorationController,
	MODIFIED_URI_SCHEME,
	DIFF_VIEW_URI_SCHEME,
} from "./decoration-controller"

export class DiffViewProvider {
	private updateQueue = new PQueue({ concurrency: 1 })
	private diffEditor?: vscode.TextEditor
	public originalContent: string = ""
	public streamedContent: string = ""
	public isEditing: boolean = false
	public relPath?: string
	private originalUri?: vscode.Uri
	private isFinalReached: boolean = false
	private modifiedUri?: vscode.Uri
	public lastEditPosition?: vscode.Position
	private lastScrollTime: number = 0
	private isAutoScrollEnabled: boolean = true
	private lastUserInteraction: number = 0
	private previousLines: string[] = []
	private static readonly SCROLL_THROTTLE = 100 // ms
	private static readonly USER_INTERACTION_TIMEOUT = 1000 // ms
	private static readonly SCROLL_THRESHOLD = 10 // lines from bottom to re-enable auto-scroll
	private static modifiedContentProvider: ModifiedContentProvider
	private disposables: vscode.Disposable[] = []
	private activeLineController?: DecorationController
	private fadedOverlayController?: DecorationController
	private currentDocument: string[] = []
	private lastModifiedLine: number = 0

	constructor(private cwd: string) {
		this.updateQueue = new PQueue({
			concurrency: 1,
			timeout: 30000, // 30 second timeout for any single operation
			throwOnTimeout: true,
		})
		if (!DiffViewProvider.modifiedContentProvider) {
			DiffViewProvider.modifiedContentProvider = new ModifiedContentProvider()
			try {
				vscode.workspace.registerFileSystemProvider(
					MODIFIED_URI_SCHEME,
					DiffViewProvider.modifiedContentProvider
				)
			} catch (e) {
				this.logger(`Failed to register file system provider: ${e}`, "error")
				// critical error - should never happen
				throw e
			}
		}
	}

	public async open(relPath: string, isFinal?: boolean): Promise<void> {
		// Enqueue the open operation
		if (this.diffEditor) {
			return
		}
		this.previousLines = []
		this.currentDocument = []
		this.lastModifiedLine = 0
		this.isEditing = true
		this.relPath = relPath
		this.isAutoScrollEnabled = true

		const absolutePath = path.resolve(this.cwd, relPath)

		try {
			const uri = vscode.Uri.file(absolutePath)
			const now = Date.now()
			const contentBuffer = await vscode.workspace.fs.readFile(uri)
			this.logger(
				`[${now}] opened file [function open]: ${relPath} with content length ${contentBuffer.length}`,
				"info"
			)
			this.originalContent = Buffer.from(contentBuffer).toString("utf8")
			this.previousLines = this.originalContent.split(/\r?\n/)
		} catch (error) {
			this.logger(`Failed to read file: ${error}`, "error")
			this.originalContent = ""
			this.previousLines = []
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

	public async openDiffEditor(relPath: string, isFinal?: boolean): Promise<void> {
		// if it's already open return
		// if (this.isDiffViewOpen()) {
		// 	return
		// }
		const fileName = path.basename(relPath)

		// Create original content URI
		this.originalUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
			query: Buffer.from(this.originalContent).toString("base64"),
		})

		// Create modified content URI (initially empty)
		this.modifiedUri = vscode.Uri.parse(`${MODIFIED_URI_SCHEME}:/${fileName}`)
		// do not await this because we didn't open the editor yet
		DiffViewProvider.modifiedContentProvider.writeFile(
			this.modifiedUri,
			new TextEncoder().encode(this.originalContent ?? ""),
			{
				create: true,
				overwrite: true,
			}
		)

		// Open diff editor with original and modified content
		await vscode.commands.executeCommand(
			"vscode.diff",
			this.originalUri,
			this.modifiedUri,
			`${fileName}: ${this.originalContent ? "Original ↔ Kodu's Changes" : "New File"} (Editable)`,
			{
				preview: true,
				preserveFocus: false,
				viewColumn: vscode.ViewColumn.Active,
				tabOptions: {
					readonly: true, // Makes the entire diff read-only
				},
			}
		)
		await pWaitFor(
			() =>
				vscode.window.visibleTextEditors.some(
					(e) => e.document.uri.toString() === this.modifiedUri!.toString()
				),
			{
				interval: 20,
				timeout: 1_000,
			}
		)
		const editor = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.toString() === this.modifiedUri!.toString()
		)

		if (editor && editor.document.uri.toString() === this.modifiedUri.toString()) {
			this.diffEditor = editor
		} else {
			this.logger("<openDiffEditor>: Failed to open diff editor", "error")
			return
			// throw new Error("Failed to open diff editor")
		}
	}

	public async update(accumulatedContent: string, isFinal: boolean): Promise<void> {
		// Enqueue the update operation
		if (!this.diffEditor || !this.modifiedUri || !this.activeLineController || !this.fadedOverlayController) {
			this.logger("<update>: Diff editor not initialized", "error")
			return
		}
		if (this.isFinalReached) {
			this.logger("<update>: Final update already reached", "warn")
			return
		}

		if (isFinal) {
			this.logger(
				`[${Date.now()}] applying final update [function update]: content length ${accumulatedContent.length}`,
				"info"
			)
			this.isFinalReached = true
			await this.updateQueue.add(async () => {
				await this.applyUpdate(accumulatedContent)
				await this?.activeLineController?.clear()
				await this?.fadedOverlayController?.clear()
			})
			return
		}
		await this.updateQueue.add(async () => await this.applyLineByLineUpdate(accumulatedContent))
	}

	private async applyLineByLineUpdate(content: string): Promise<void> {
		if (!this.diffEditor || !this.modifiedUri) {
			this.logger("<applyLineByLineUpdate>: Diff editor not initialized", "error")
			return
		}
		if (this.isFinalReached) {
			this.logger("<applyLineByLineUpdate>: Final update already reached", "warn")
			return
		}

		// Split incoming content into lines
		const newLines = content.split(/\r?\n/)

		// Initialize current document content if needed
		if (this.currentDocument.length === 0) {
			const currentContent = this.diffEditor.document.getText()
			this.currentDocument = currentContent ? currentContent.split(/\r?\n/) : []
			this.previousLines = [...this.currentDocument]
		}

		// Quick check if content is identical
		if (this.previousLines.join("\n") === newLines.join("\n")) {
			return
		}

		// Compare line by line and only update what's necessary
		for (let i = 0; i < newLines.length; i++) {
			// If line is different or new, update it
			if (i >= this.currentDocument.length || this.currentDocument[i] !== newLines[i]) {
				// Handle case where we're adding new lines
				if (i >= this.currentDocument.length) {
					this.currentDocument[i] = newLines[i]
				} else {
					// Replace existing line
					this.currentDocument[i] = newLines[i]
				}
				this.lastModifiedLine = i
			}
		}

		// Create the final content string, preserving any remaining lines
		const updatedContent = [
			...this.currentDocument.slice(0, Math.max(newLines.length, this.currentDocument.length)),
		].join("\n")

		// Update content with proper options to maintain file history
		await DiffViewProvider.modifiedContentProvider.writeFile(
			this.modifiedUri,
			new TextEncoder().encode(updatedContent),
			{
				create: false,
				overwrite: true,
			}
		)
		// Optional: Add extra safety by waiting for next VS Code tick
		await new Promise((resolve) => setTimeout(resolve, 0))

		this.streamedContent = updatedContent

		// Update decoration for the changed line
		if (this.activeLineController && this.fadedOverlayController) {
			this.activeLineController.setActiveLine(this.lastModifiedLine)
			this.fadedOverlayController.updateOverlayAfterLine(
				this.lastModifiedLine,
				this.diffEditor.document.lineCount
			)
		}

		// Handle auto-scrolling to the modified line
		const now = Date.now()
		if (
			this.isAutoScrollEnabled &&
			now - this.lastScrollTime >= DiffViewProvider.SCROLL_THROTTLE &&
			(now - this.lastUserInteraction >= DiffViewProvider.USER_INTERACTION_TIMEOUT || this.checkScrollPosition())
		) {
			await this.scrollToModifiedLine()
			this.lastScrollTime = now
		}

		// Store the current state for next comparison
		this.previousLines = [...newLines]
	}

	private async scrollToModifiedLine(): Promise<void> {
		if (!this.diffEditor) {
			return
		}

		const line = Math.max(0, this.lastModifiedLine)
		const range = new vscode.Range(line, 0, line, this.diffEditor.document.lineAt(line).text.length)

		this.diffEditor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
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
			this.lastModifiedLine >= firstVisibleLine - DiffViewProvider.SCROLL_THRESHOLD &&
			this.lastModifiedLine <= lastVisibleLine + DiffViewProvider.SCROLL_THRESHOLD
		)
	}

	private async applyUpdate(content: string): Promise<void> {
		if (!this.diffEditor || !this.modifiedUri) {
			this.logger("<applyUpdate>: Diff editor not initialized", "error")
			return
		}

		this.logger(`Applying update: content length ${content.length}`, "info")

		// Update content with proper options to maintain file history
		await DiffViewProvider.modifiedContentProvider.writeFile(this.modifiedUri, new TextEncoder().encode(content), {
			create: false,
			overwrite: true,
		})

		this.streamedContent = content
	}

	public async revertChanges(): Promise<void> {
		// Enqueue the revert operation

		if (!this.relPath) {
			return
		}

		await this.updateQueue.add(async () => {
			this.disposables.forEach((d) => d.dispose())
			await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor")

			if (this.originalContent === "") {
				const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath!))
				try {
					await vscode.workspace.fs.delete(uri)
				} catch (error) {
					this.logger("Failed to delete new file:", "error")
				}
			}

			this.isEditing = false
			await this.reset()
		})
	}

	private async reset(): Promise<void> {
		if (this.modifiedUri) {
			try {
				DiffViewProvider.modifiedContentProvider.delete(this.modifiedUri)
			} catch (error) {
				// Ignore deletion errors
			}
		}

		this.previousLines = []
		this.currentDocument = []
		this.lastModifiedLine = 0
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
	}

	public async saveChanges(): Promise<{ userEdits: string | undefined; finalContent: string }> {
		try {
			if (!this.relPath) {
				throw new Error("No file path set")
			}

			if (!this.diffEditor || this.diffEditor.document.isClosed) {
				throw new Error("Diff editor is not initialized or has been closed")
			}
			await this.updateQueue.onIdle()
			const updatedDocument = this.diffEditor.document

			const editedContent = updatedDocument.getText()

			const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))

			// Ensure directories exist before writing
			await createDirectoriesForFile(uri.fsPath)

			// Write file with error handling
			try {
				// before writing to file make sure it's not dirty
				try {
					const doc = await vscode.workspace.openTextDocument(uri)
					if (doc.isDirty) {
						await doc.save()
					}
					// Show the document to ensure it’s the active editor
					const editor = await vscode.window.showTextDocument(doc)
					// Close the active editor
					await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
				} catch (e) {
					this.logger(
						`While saving to doc encountered a doc that is non existent meaning it's a new file`,
						"warn"
					)
				}

				// update the file with the edited content
				await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(editedContent))
				// we save the file after writing to it
				await vscode.workspace.save(uri)
			} catch (error) {
				throw new Error(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`)
			}

			// Close diff views
			await this.closeAllDiffViews()

			// open document again
			await vscode.window.showTextDocument(uri)

			// Compare contents and create patch if needed
			const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
			const normalizedStreamedContent = this.streamedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"

			if (normalizedEditedContent !== normalizedStreamedContent) {
				const userEdits = await this.createPrettyPatch(
					this.relPath.replace(/\\/g, "/"), // Ensure forward slashes for consistency
					normalizedStreamedContent,
					normalizedEditedContent
				)
				return { userEdits, finalContent: normalizedEditedContent }
			}

			return { userEdits: undefined, finalContent: normalizedEditedContent }
		} catch (error) {
			this.logger(`Failed to save changes: ${error}`, "error")
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

	private logger(message: string, level: "info" | "warn" | "error" = "info") {
		console[level](`[DiffViewProvider] ${message}`)
	}
}
