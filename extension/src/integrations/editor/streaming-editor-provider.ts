/**
 * THIS FILE WAS CREATED BY KODU.AI - https://kodu.ai/
 * Streaming editor with line-by-line updates and diff view
 */
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { createDirectoriesForFile } from "../../utils/fs"
import * as diff from "diff"
import { arePathsEqual } from "../../utils/path-helpers"
import { KoduDev } from "../../agent/v1"

// Decoration for existing content
const fadedOverlayDecorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: "rgba(255, 255, 0, 0.1)",
	opacity: "0.4",
	isWholeLine: true,
})

// Decoration for active line
const activeLineDecorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: "rgba(255, 255, 0, 0.3)",
	opacity: "1",
	isWholeLine: true,
	border: "1px solid rgba(255, 255, 0, 0.5)",
})

export class StreamingEditorProvider {
	private editor?: vscode.TextEditor
	private originalContent: string = ""
	private streamedContent: string = ""
	public isEditing: boolean = false
	private relPath?: string
	private koduDev: KoduDev
	private streamedLines: string[] = []
	private documentWasOpen: boolean = false

	constructor(private cwd: string, koduDev: KoduDev) {
		this.koduDev = koduDev
	}

	public async open(relPath: string): Promise<void> {
		if (this.editor) {
			return
		}

		this.isEditing = true
		this.relPath = relPath
		const absolutePath = path.resolve(this.cwd, relPath)
		const uri = vscode.Uri.file(absolutePath)

		try {
			// Check if document is already open
			const openEditor = vscode.window.visibleTextEditors.find((editor) =>
				arePathsEqual(editor.document.uri.fsPath, uri.fsPath)
			)

			if (openEditor) {
				this.editor = openEditor
				this.originalContent = openEditor.document.getText()
				this.documentWasOpen = true
			} else {
				try {
					const doc = await vscode.workspace.openTextDocument(uri)
					this.editor = await vscode.window.showTextDocument(doc)
					this.originalContent = doc.getText()
				} catch {
					// File doesn't exist yet
					this.originalContent = ""
					const doc = await vscode.workspace.openTextDocument(uri)
					this.editor = await vscode.window.showTextDocument(doc)
				}
			}

			// Initialize with original content
			const edit = new vscode.WorkspaceEdit()
			edit.replace(
				this.editor.document.uri,
				new vscode.Range(0, 0, this.editor.document.lineCount, 0),
				this.originalContent
			)
			await vscode.workspace.applyEdit(edit)

			// Set initial decorations
			if (this.originalContent) {
				const lines = this.originalContent.split("\n")
				const ranges = lines.map((_, i) => new vscode.Range(i, 0, i, lines[i].length))
				this.editor.setDecorations(fadedOverlayDecorationType, ranges)
			}

			// Reset streamed lines
			this.streamedLines = []
		} catch (error) {
			this.logger(`Failed to open file: ${error}`, "error")
			throw error
		}
	}

	public async update(accumulatedContent: string, isFinal: boolean): Promise<void> {
		if (!this.editor || !this.isEditing) {
			return
		}

		this.streamedContent = accumulatedContent
		const accumulatedLines = accumulatedContent.split("\n")

		if (!isFinal) {
			accumulatedLines.pop() // remove last partial line if not final
		}

		const diffLines = accumulatedLines.slice(this.streamedLines.length)

		// Place cursor at beginning to keep it out of the way
		const beginningOfDocument = new vscode.Position(0, 0)
		this.editor.selection = new vscode.Selection(beginningOfDocument, beginningOfDocument)

		for (let i = 0; i < diffLines.length; i++) {
			const currentLine = this.streamedLines.length + i

			// Replace all content up to current line
			const edit = new vscode.WorkspaceEdit()
			const rangeToReplace = new vscode.Range(0, 0, currentLine + 1, 0)
			const contentToReplace = accumulatedLines.slice(0, currentLine + 1).join("\n") + "\n"
			edit.replace(this.editor.document.uri, rangeToReplace, contentToReplace)
			await vscode.workspace.applyEdit(edit)

			// Update decorations
			const existingRanges = Array.from(
				{ length: currentLine },
				(_, idx) => new vscode.Range(idx, 0, idx, this.editor!.document.lineAt(idx).text.length)
			)
			const activeLine = new vscode.Range(
				currentLine,
				0,
				currentLine,
				this.editor.document.lineAt(currentLine).text.length
			)

			this.editor.setDecorations(fadedOverlayDecorationType, existingRanges)
			this.editor.setDecorations(activeLineDecorationType, [activeLine])

			// Scroll to current line
			this.editor.revealRange(activeLine, vscode.TextEditorRevealType.InCenter)
		}

		// Update streamed lines
		this.streamedLines = accumulatedLines

		if (isFinal) {
			// Handle any remaining lines if new content is shorter
			if (this.streamedLines.length < this.editor.document.lineCount) {
				const edit = new vscode.WorkspaceEdit()
				edit.delete(
					this.editor.document.uri,
					new vscode.Range(this.streamedLines.length, 0, this.editor.document.lineCount, 0)
				)
				await vscode.workspace.applyEdit(edit)
			}

			// Add empty last line if original had one
			if (this.originalContent.endsWith("\n")) {
				if (!accumulatedContent.endsWith("\n")) {
					const edit = new vscode.WorkspaceEdit()
					edit.insert(this.editor.document.uri, new vscode.Position(this.editor.document.lineCount, 0), "\n")
					await vscode.workspace.applyEdit(edit)
				}
			}

			// Clear decorations before showing diff
			this.editor.setDecorations(fadedOverlayDecorationType, [])
			this.editor.setDecorations(activeLineDecorationType, [])

			await this.showFinalDiff()
		}
	}

	private async showFinalDiff(): Promise<void> {
		if (!this.editor || !this.relPath) {
			return
		}

		const fileName = path.basename(this.relPath)

		// Register content provider for original content
		const originalScheme = "claude-original"
		const registration = vscode.workspace.registerTextDocumentContentProvider(originalScheme, {
			provideTextDocumentContent: () => this.originalContent,
		})

		try {
			// Create URIs for diff
			const originalUri = vscode.Uri.parse(`${originalScheme}:${fileName}`)
			const modifiedUri = this.editor.document.uri

			// Show diff
			await vscode.commands.executeCommand(
				"vscode.diff",
				originalUri,
				modifiedUri,
				`${fileName}: Original ↔ Changes (Accept to save)`,
				{ preview: true }
			)
		} finally {
			registration.dispose()
		}
	}

	public isDiffViewOpen(): boolean {
		return this.isEditing
	}

	public async revertChanges(): Promise<void> {
		if (!this.editor) {
			return
		}

		// Revert as single operation
		const edit = new vscode.WorkspaceEdit()
		edit.replace(
			this.editor.document.uri,
			new vscode.Range(0, 0, this.editor.document.lineCount, 0),
			this.originalContent
		)
		await vscode.workspace.applyEdit(edit)

		// Clear decorations
		this.editor.setDecorations(fadedOverlayDecorationType, [])
		this.editor.setDecorations(activeLineDecorationType, [])

		this.isEditing = false
		await this.reset()
	}

	public async saveChanges(): Promise<{ userEdits: string | undefined; finalContent: string }> {
		try {
			if (!this.editor || !this.relPath) {
				throw new Error("Editor not initialized")
			}

			const editedContent = this.editor.document.getText()
			await this.editor.document.save()

			// Clear decorations
			this.editor.setDecorations(fadedOverlayDecorationType, [])
			this.editor.setDecorations(activeLineDecorationType, [])

			// Close diff view
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor")

			// Check for user edits
			const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
			const normalizedStreamedContent = this.streamedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"

			let userEdits: string | undefined
			if (normalizedEditedContent !== normalizedStreamedContent) {
				userEdits = await this.createPatch(
					this.relPath.replace(/\\/g, "/"),
					normalizedStreamedContent,
					normalizedEditedContent
				)
			}

			return { userEdits, finalContent: normalizedEditedContent }
		} catch (error) {
			this.logger(`Failed to save changes: ${error}`, "error")
			throw error
		}
	}

	private async createPatch(filename: string, oldStr: string, newStr: string): Promise<string> {
		const patch = diff.createPatch(filename, oldStr, newStr)
		return patch.split("\n").slice(4).join("\n")
	}

	private async reset(): Promise<void> {
		this.editor = undefined
		this.streamedContent = ""
		this.originalContent = ""
		this.isEditing = false
		this.streamedLines = []
		this.documentWasOpen = false
	}

	private logger(message: string, level: "info" | "warn" | "error" = "info") {
		console[level](`[StreamingEditorProvider] ${message}`)
	}
}
