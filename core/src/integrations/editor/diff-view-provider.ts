import * as vscode from "vscode" // TODO: refactor
import * as path from "path"
import * as fs from "fs/promises"
import { createDirectoriesForFile } from "@/utils"
import * as diff from "diff"
import { arePathsEqual } from "@/utils"
import { IKoduDev } from "@/interfaces"

export const DIFF_VIEW_URI_SCHEME = "claude-coder-diff"

export class DiffViewProvider {
	private diffEditor?: vscode.TextEditor
	public originalContent: string = ""
	public streamedContent: string = ""
	public isEditing: boolean = false
	public relPath?: string
	private originalUri?: vscode.Uri
	private modifiedUri?: vscode.Uri
	public lastEditPosition?: vscode.Position
	private updateTimeout: NodeJS.Timeout | null = null
	private updateInterval: number

	constructor(private cwd: string, updateInterval: number = 8) {
		this.updateInterval = updateInterval
	}

	public async open(relPath: string): Promise<void> {
		this.isEditing = true
		this.relPath = relPath
		const absolutePath = path.resolve(this.cwd, relPath)

		// Check if file exists, if not, use empty content
		try {
			this.originalContent = await fs.readFile(absolutePath, "utf-8")
		} catch (error) {
			this.originalContent = ""
		}

		// Open diff editor
		await this.openDiffEditor(relPath)
	}

	private async openDiffEditor(relPath: string): Promise<void> {
		await this.closeAllDiffViews()
		const fileName = path.basename(relPath)
		this.originalUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
			query: Buffer.from(this.originalContent).toString("base64"),
		})
		this.modifiedUri = vscode.Uri.file(path.resolve(this.cwd, relPath))

		// Ensure the file exists before opening the diff view
		await createDirectoriesForFile(this.modifiedUri.fsPath)
		await vscode.workspace.fs.writeFile(this.modifiedUri, new Uint8Array())

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
		if (!this.diffEditor) {
			throw new Error("Diff editor not initialized")
		}
		if (isFinal) {
			if (this.updateTimeout) {
				clearTimeout(this.updateTimeout)
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
			if (isFinal) {
				await this.finalizeDiff()
			}
		}, this.updateInterval)
	}

	private async applyUpdate(content: string): Promise<void> {
		if (!this.diffEditor) {
			return
		}

		const document = this.diffEditor.document
		const edit = new vscode.WorkspaceEdit()
		const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))
		edit.replace(document.uri!, fullRange, content)
		await vscode.workspace.applyEdit(edit)

		this.streamedContent = content

		this.scrollToBottom()
	}

	private scrollToBottom(): void {
		if (this.diffEditor) {
			const lastLine = this.diffEditor.document.lineCount - 1
			const lastCharacter = this.diffEditor.document.lineAt(lastLine).text.length
			const range = new vscode.Range(lastLine, lastCharacter, lastLine, lastCharacter)
			this.diffEditor.revealRange(range, vscode.TextEditorRevealType.Default)
		}
	}

	private async finalizeDiff(): Promise<void> {
		if (!this.diffEditor || !this.relPath) {
			return
		}

		const fileName = path.basename(this.relPath)

		// Ensure the content is up to date
		await this.applyUpdate(this.streamedContent)

		// Update the diff view title without closing the editor
		this.lastEditPosition = new vscode.Position(this.diffEditor.document.lineCount - 1, 0)

		// Scroll to the bottom of the finalized diff view
		this.scrollToBottom()
	}

	public async revertChanges(): Promise<void> {
		// Close the diff view without saving changes
		if (!this.relPath) {
			return
			// throw new Error("No file path set or diff editor not initialized")
		}
		await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor")

		// If it was a new file, we should delete it
		if (this.originalContent === "") {
			const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))
			try {
				await vscode.workspace.fs.delete(uri)
			} catch (error) {
				console.error("Failed to delete new file:", error)
			}
		} else {
			// For existing files, restore the original content
			const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))
			await vscode.workspace.fs.writeFile(uri, Buffer.from(this.originalContent))
		}

		this.isEditing = false
		await this.reset()
	}

	private async reset(): Promise<void> {
		this.diffEditor = undefined
		this.streamedContent = ""
		this.lastEditPosition = undefined
	}

	public async acceptChanges(): Promise<void> {
		if (!this.relPath || !this.diffEditor) {
			throw new Error("No file path set or diff editor not initialized")
		}
		const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))
		await vscode.workspace.fs.writeFile(uri, Buffer.from(this.streamedContent))
		this.isEditing = false

		// Close the diff view
		await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor")
	}

	public async saveChanges(): Promise<{ userEdits: string | undefined }> {
		if (!this.relPath || !this.diffEditor) {
			throw new Error("No file path set or diff editor not initialized")
		}

		const absolutePath = path.resolve(this.cwd, this.relPath)
		const updatedDocument = this.diffEditor.document
		const editedContent = updatedDocument.getText()
		if (updatedDocument.isDirty) {
			await updatedDocument.save()
		}

		await this.closeAllDiffViews()
		// Open the file in the editor
		const uri = vscode.Uri.file(absolutePath)
		if (!vscode.window.visibleTextEditors.some((editor) => arePathsEqual(editor.document.uri.fsPath, uri.fsPath))) {
			const document = await vscode.workspace.openTextDocument(uri)
			await vscode.window.showTextDocument(document, { preview: false })
		}

		// Check for user edits
		const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
		const normalizedStreamedContent = this.streamedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"

		if (normalizedEditedContent !== normalizedStreamedContent) {
			const userEdits = await this.createPrettyPatch(
				this.relPath.toPosix(),
				normalizedStreamedContent,
				normalizedEditedContent
			)
			return { userEdits }
		} else {
			return { userEdits: undefined }
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
				(tab) => tab.input instanceof vscode.TabInputTextDiff && tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME
			)
		for (const tab of tabs) {
			// Trying to close dirty views results in save popup
			if (!tab.isDirty) {
				await vscode.window.tabGroups.close(tab)
			}
		}
	}
}
