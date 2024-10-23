import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { createDirectoriesForFile } from "../../utils/fs"
import * as diff from "diff"
import { arePathsEqual } from "../../utils/path-helpers"
import { KoduDev } from "../../agent/v1"
import delay from "delay"
import * as os from "os"

export const DIFF_VIEW_URI_SCHEME = "claude-coder-diff-inmemory"

interface AnimationOptions {
	enabled: boolean
	overlayAnimation: boolean
	animationSpeed: number // milliseconds per character
}

export class DiffViewProviderInMemory {
	private diffEditor?: vscode.TextEditor
	private memoryContent: Map<string, string> = new Map()
	public originalContent: string = ""
	public streamedContent: string = ""
	public isEditing: boolean = false
	public relPath?: string
	private originalUri?: vscode.Uri
	private modifiedUri?: vscode.Uri
	private koduDev: KoduDev
	public lastEditPosition?: vscode.Position
	private updateTimeout: NodeJS.Timeout | null = null
	private animationTimeout: NodeJS.Timeout | null = null
	private preDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = []
	private updateInterval: number
	private animationOptions: AnimationOptions
	private tmpDir: string

	constructor(
		private cwd: string,
		koduDev: KoduDev,
		updateInterval: number = 8,
		animationOptions: Partial<AnimationOptions> = {}
	) {
		this.koduDev = koduDev
		this.updateInterval = updateInterval
		this.animationOptions = {
			enabled: true,
			overlayAnimation: true,
			animationSpeed: 16, // ~60fps
			...animationOptions,
		}
		this.tmpDir = os.tmpdir()
	}

	public setAnimationOptions(options: Partial<AnimationOptions>) {
		this.animationOptions = {
			...this.animationOptions,
			...options,
		}
	}

	public async open(relPath: string): Promise<void> {
		this.isEditing = true
		this.relPath = relPath

		// Get content from memory or initialize
		this.originalContent = this.memoryContent.get(relPath) || ""

		// Create temporary files for diff view
		await this.openDiffEditor(relPath)
	}

	private async createTempFile(content: string): Promise<string> {
		const tempPath = path.join(this.tmpDir, `kodu-diff-${Date.now()}-${Math.random().toString(36).slice(2)}`)
		await fs.writeFile(tempPath, content)
		return tempPath
	}

	private async openDiffEditor(relPath: string): Promise<void> {
		await this.closeAllDiffViews()
		const fileName = path.basename(relPath)

		// Create temporary files for diff view
		const originalTempPath = await this.createTempFile(this.originalContent)
		const modifiedTempPath = await this.createTempFile("")

		this.originalUri = vscode.Uri.file(originalTempPath)
		this.modifiedUri = vscode.Uri.file(modifiedTempPath)

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

		if (this.animationOptions.enabled && this.animationOptions.overlayAnimation) {
			await this.animateContentOverlay(accumulatedContent, isFinal)
		} else {
			await this.regularUpdate(accumulatedContent, isFinal)
		}
	}

	private async animateContentOverlay(content: string, isFinal: boolean): Promise<void> {
		if (!this.diffEditor) return

		if (this.animationTimeout) {
			clearTimeout(this.animationTimeout)
		}

		const currentContent = this.diffEditor.document.getText()
		const contentDiff = diff.diffChars(currentContent, content)
		let animatedContent = currentContent

		for (const part of contentDiff) {
			if (part.added) {
				const chars = part.value.split("")
				for (const char of chars) {
					animatedContent = animatedContent + char
					await this.applyUpdate(animatedContent)
					await delay(this.animationOptions.animationSpeed)
				}
			} else if (part.removed) {
				const chars = part.value.split("")
				for (let i = 0; i < chars.length; i++) {
					animatedContent = animatedContent.slice(0, -1)
					await this.applyUpdate(animatedContent)
					await delay(this.animationOptions.animationSpeed)
				}
			}
		}

		if (isFinal) {
			await this.finalizeDiff()
		}
	}

	private async regularUpdate(content: string, isFinal: boolean): Promise<void> {
		if (isFinal) {
			if (this.updateTimeout) {
				clearTimeout(this.updateTimeout)
			}
			await this.applyUpdate(content)
			await this.finalizeDiff()
			return
		}

		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout)
		}

		this.updateTimeout = setTimeout(async () => {
			await this.applyUpdate(content)
		}, this.updateInterval)
	}

	private async applyUpdate(content: string): Promise<void> {
		if (!this.diffEditor) return

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
		if (!this.diffEditor || !this.relPath) return

		await this.applyUpdate(this.streamedContent)
		this.lastEditPosition = new vscode.Position(this.diffEditor.document.lineCount - 1, 0)
		this.scrollToBottom()
	}

	public async revertChanges(): Promise<void> {
		if (!this.relPath) return

		await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor")
		this.isEditing = false
		await this.reset()
	}

	private async reset(): Promise<void> {
		this.diffEditor = undefined
		this.streamedContent = ""
		this.lastEditPosition = undefined

		// Clean up temporary files
		if (this.originalUri) {
			try {
				await fs.unlink(this.originalUri.fsPath)
			} catch (error) {
				console.error("Failed to delete temporary file:", error)
			}
		}
		if (this.modifiedUri) {
			try {
				await fs.unlink(this.modifiedUri.fsPath)
			} catch (error) {
				console.error("Failed to delete temporary file:", error)
			}
		}
	}

	public async acceptChanges(): Promise<void> {
		if (!this.relPath || !this.diffEditor) {
			throw new Error("No file path set or diff editor not initialized")
		}

		// Store in memory
		this.memoryContent.set(this.relPath, this.streamedContent)
		this.isEditing = false

		// Close the diff view
		await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor")
		await this.reset()
	}

	public async saveChanges(): Promise<{ userEdits: string | undefined }> {
		if (!this.relPath || !this.diffEditor) {
			throw new Error("No file path set or diff editor not initialized")
		}

		const updatedDocument = this.diffEditor.document
		const editedContent = updatedDocument.getText()

		await this.closeAllDiffViews()

		// Check for user edits
		const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"
		const normalizedStreamedContent = this.streamedContent.replace(/\r\n|\n/g, "\n").trimEnd() + "\n"

		if (normalizedEditedContent !== normalizedStreamedContent) {
			const userEdits = await this.createPrettyPatch(
				this.relPath,
				normalizedStreamedContent,
				normalizedEditedContent
			)
			return { userEdits }
		}

		return { userEdits: undefined }
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
					tab.input instanceof vscode.TabInputTextDiff && tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME
			)
		for (const tab of tabs) {
			if (!tab.isDirty) {
				await vscode.window.tabGroups.close(tab)
			}
		}
	}

	public getContent(relPath: string): string | undefined {
		return this.memoryContent.get(relPath)
	}

	public clearMemory(): void {
		this.memoryContent.clear()
	}
}
