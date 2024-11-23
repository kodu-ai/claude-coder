import { EditBlock, parseDiffBlocks } from "@/agent/v1/tools/runners/coders/utils"
import * as vscode from "vscode"

export class InlineEditHandler {
	private editor: vscode.TextEditor | null = null
	private originalContent: string = ""
	private accumulatedDiff: string = ""

	/**
	 * Initializes the handler with the active editor.
	 */
	public initializeEditor(editor: vscode.TextEditor) {
		this.editor = editor
		this.originalContent = editor.document.getText()
		this.accumulatedDiff = ""
	}

	/**
	 * Handles the incoming diff string for inline edits.
	 */
	public async handleDiffUpdate(diff: string, isFinal: boolean = false) {
		if (!this.editor) {
			console.warn("No active editor found for applying inline edits.")
			return
		}

		try {
			// Accumulate the diff content
			this.accumulatedDiff += diff

			// Try to parse and apply the accumulated diff
			if (this.accumulatedDiff.includes("SEARCH") && this.accumulatedDiff.includes("REPLACE")) {
				const editBlocks = parseDiffBlocks(this.accumulatedDiff, this.editor.document.uri.fsPath)
				
				// Process each block
				for (const block of editBlocks) {
					await this.applyEdit(block)
				}
			}

			// Clear accumulated diff if this is the final update
			if (isFinal) {
				this.accumulatedDiff = ""
			}
		} catch (error) {
			console.error("Error processing inline edits:", error)
		}
	}

	/**
	 * Applies a single edit block.
	 */
	private async applyEdit(block: EditBlock) {
		if (!this.editor) {
			return
		}

		const document = this.editor.document
		const content = document.getText()
		const { searchContent, replaceContent } = block

		// Find exact match position
		const matchIndex = content.indexOf(searchContent)
		if (matchIndex === -1) {
			console.warn(`Failed to find matching content for block: ${searchContent}`)
			return
		}

		// Create and apply the edit
		const startPosition = document.positionAt(matchIndex)
		const endPosition = document.positionAt(matchIndex + searchContent.length)
		const range = new vscode.Range(startPosition, endPosition)

		const edit = new vscode.WorkspaceEdit()
		edit.replace(document.uri, range, replaceContent)
		await vscode.workspace.applyEdit(edit)
	}

	/**
	 * Rolls back all changes to the original state.
	 */
	public async rollback(): Promise<void> {
		if (!this.editor) {
			return
		}

		const edit = new vscode.WorkspaceEdit()
		const fullRange = new vscode.Range(
			this.editor.document.positionAt(0),
			this.editor.document.positionAt(this.editor.document.getText().length)
		)

		edit.replace(this.editor.document.uri, fullRange, this.originalContent)
		await vscode.workspace.applyEdit(edit)
		this.accumulatedDiff = ""
	}

	/**
	 * Saves the current state of the document.
	 */
	public async save(): Promise<void> {
		if (!this.editor) {
			throw new Error("No editor initialized")
		}

		await this.editor.document.save()
	}
}
