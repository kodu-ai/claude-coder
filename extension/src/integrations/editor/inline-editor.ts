import * as vscode from "vscode"
import { diff_match_patch } from "diff-match-patch"

// Update the EditBlock interface
interface EditBlock {
	id: string
	range: vscode.Range
	originalContent: string
	currentContent: string
	finalContent?: string
	status: "pending" | "streaming" | "final"
	matchedRange?: vscode.Range
}

interface DocumentState {
	uri: string
	originalContent: string // Store complete original document content
	editBlocks: Map<string, EditBlock>
	activeMergeRanges: Map<string, vscode.Range>
	activeStreamingRanges: Map<string, vscode.Range>
	activePendingRanges: Map<string, vscode.Range>
}

export class InlineEditHandler {
	private pendingDecoration!: vscode.TextEditorDecorationType
	private streamingDecoration!: vscode.TextEditorDecorationType
	private mergeDecoration!: vscode.TextEditorDecorationType
	private isAutoScrollEnabled: boolean = true
	private disposables: vscode.Disposable[] = []
	private isFirstEditTouched: boolean = false

	private currentDocumentState: DocumentState | undefined
	private lastActiveEditor: vscode.TextEditor | undefined

	constructor() {
		this.initializeDecorations()
	}

	private findBestMatchingRange(document: vscode.TextDocument, searchContent: string): vscode.Range | undefined {
		const dmp = new diff_match_patch()
		dmp.Match_Threshold = 0.1 // Set a low threshold for high accuracy
		dmp.Match_Distance = 2000 // Adjust as needed

		const text = document.getText()
		const loc = 0 // Start location

		const matchIndex = dmp.match_main(text, searchContent, loc)

		if (matchIndex === -1) {
			return undefined
		}

		const startPos = document.positionAt(matchIndex)
		const endPos = document.positionAt(matchIndex + searchContent.length)
		return new vscode.Range(startPos, endPos)
	}

	private initializeDecorations() {
		this.pendingDecoration = vscode.window.createTextEditorDecorationType({
			isWholeLine: true,
			after: {
				margin: "0 0 0 1em",
				contentText: "⟳ Pending changes",
				color: new vscode.ThemeColor("editorGhostText.foreground"),
			},
		})

		this.streamingDecoration = vscode.window.createTextEditorDecorationType({
			isWholeLine: true,
			after: {
				margin: "0 0 0 1em",
				contentText: "↻ Streaming changes...",
				color: new vscode.ThemeColor("editorInfo.foreground"),
			},
		})

		this.mergeDecoration = vscode.window.createTextEditorDecorationType({
			isWholeLine: true,
			after: {
				margin: "0 0 0 1em",
				contentText: "⚡ Review changes",
				color: new vscode.ThemeColor("editorInfo.foreground"),
			},
		})
	}

	// Modified open method to be more focused on initialization
	public async open(id: string, filePath: string, searchContent: string): Promise<boolean> {
		try {
			const document = await vscode.workspace.openTextDocument(filePath)
			const editor = await vscode.window.showTextDocument(document, {
				viewColumn: vscode.ViewColumn.Active,
				preserveFocus: false,
				preview: false,
			})
			const originalContent = document.getText()

			// Initialize document state if it doesn't exist or is for a different file
			if (!this.currentDocumentState || this.currentDocumentState.uri !== document.uri.toString()) {
				this.currentDocumentState = {
					uri: document.uri.toString(),
					originalContent,
					editBlocks: new Map(),
					activeMergeRanges: new Map(),
					activeStreamingRanges: new Map(),
					activePendingRanges: new Map(),
				}
			}

			this.lastActiveEditor = editor

			// Add the initial block
			const block = await this.addBlockToDocument(document, id, searchContent)
			if (!block) {
				return false
			}
			return true
		} catch (error) {
			console.error("Failed to open document:", error)
			return false
		}
	}

	public async focusEditor(): Promise<void> {
		if (!this.currentDocumentState) {
			console.warn("No active document state to focus")
			return
		}

		try {
			const uri = vscode.Uri.parse(this.currentDocumentState.uri)

			// First try to find an already open editor
			const visibleEditors = vscode.window.visibleTextEditors
			const existingEditor = visibleEditors.find(
				(editor) => editor.document.uri.toString() === this.currentDocumentState?.uri
			)

			if (existingEditor) {
				// If editor exists, bring it to focus
				await vscode.window.showTextDocument(existingEditor.document, {
					viewColumn: vscode.ViewColumn.Active,
					preserveFocus: false, // This ensures the editor gets focus
					preview: false, // This ensures the editor stays open and doesn't open in preview mode
				})
			} else {
				// If editor is not open, open the document and focus it
				const document = await vscode.workspace.openTextDocument(uri)
				await vscode.window.showTextDocument(document, {
					preserveFocus: false,
					preview: false,
					viewColumn: vscode.ViewColumn.Active,
				})
			}

			// Update the lastActiveEditor reference
			this.lastActiveEditor = vscode.window.activeTextEditor
		} catch (error) {
			console.error("Failed to focus editor:", error)
			throw new Error(`Failed to focus editor: ${error instanceof Error ? error.message : "Unknown error"}`)
		}
	}

	private async addBlockToDocument(
		document: vscode.TextDocument,
		id: string,
		searchContent: string
	): Promise<EditBlock | undefined> {
		if (!this.currentDocumentState) {
			return undefined
		}

		try {
			const currentContent = document.getText()
			let range: vscode.Range | undefined

			// First, try to find an exact match
			let startIndex = currentContent.indexOf(searchContent)

			if (startIndex !== -1) {
				const startPos = document.positionAt(startIndex)
				const endPos = document.positionAt(startIndex + searchContent.length)
				range = new vscode.Range(startPos, endPos)
			} else {
				// Perform fuzzy matching
				range = this.findBestMatchingRange(document, searchContent)
				if (!range) {
					console.warn(`Could not find searchContent for block ${id}`)
					return undefined
				}
			}

			// Check for overlapping blocks
			for (const [, existingBlock] of this.currentDocumentState.editBlocks) {
				if (range.intersection(existingBlock.range)) {
					console.warn(`Block ${id} would overlap with existing block`)
					return undefined
				}
			}

			const editBlock: EditBlock = {
				id,
				range,
				originalContent: searchContent,
				currentContent: searchContent,
				status: "pending",
				matchedRange: range, // Cache the matched range
			}

			this.currentDocumentState.editBlocks.set(id, editBlock)
			this.currentDocumentState.activePendingRanges.set(id, range)

			return editBlock
		} catch (error) {
			console.error("Failed to add block:", error)
			return undefined
		}
	}

	public async applyStreamContent(id: string, searchContent: string, content: string): Promise<boolean> {
		if (!this.currentDocumentState) {
			return false
		}

		try {
			const document =
				vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === this.currentDocumentState!.uri) ||
				(await vscode.workspace.openTextDocument(vscode.Uri.parse(this.currentDocumentState!.uri)))

			let editBlock = this.currentDocumentState.editBlocks.get(id)

			// If block doesn't exist, try to create it
			if (!editBlock) {
				editBlock = await this.addBlockToDocument(document, id, searchContent)
				if (!editBlock) {
					return false
				}
			}

			// Use the stored originalContent to find the range
			const currentContent = document.getText()
			let startIndex = currentContent.indexOf(editBlock.originalContent)

			let range: vscode.Range

			if (startIndex !== -1) {
				const startPos = document.positionAt(startIndex)
				const endPos = document.positionAt(startIndex + editBlock.originalContent.length)
				range = new vscode.Range(startPos, endPos)
			} else {
				// Use the last known range
				range = editBlock.matchedRange || editBlock.range
			}

			const workspaceEdit = new vscode.WorkspaceEdit()
			workspaceEdit.replace(document.uri, range, content, {
				label: "Inline Edit",
				needsConfirmation: false,
			})
			const didApplyCorrectly = await vscode.workspace.applyEdit(workspaceEdit, {
				isRefactoring: true,
			})
			if (!didApplyCorrectly) {
				console.error("Failed to apply streaming content")
			}

			const newEndPos = document.positionAt(document.offsetAt(range.start) + content.length)
			const newRange = new vscode.Range(range.start, newEndPos)

			const updatedBlock: EditBlock = {
				...editBlock,
				range: newRange,
				matchedRange: newRange,
				currentContent: content,
				status: "streaming" as const,
			}

			this.currentDocumentState.editBlocks.set(id, updatedBlock)
			this.currentDocumentState.activePendingRanges.delete(id)
			this.currentDocumentState.activeStreamingRanges.set(id, newRange)

			// Update decorations and scroll if editor is available
			const editor = await this.getOrCreateEditor()
			if (editor) {
				this.updateDecorations(editor)
				await this.scrollToRange(editor, newRange)
			}

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

		try {
			const document =
				vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === this.currentDocumentState!.uri) ||
				(await vscode.workspace.openTextDocument(vscode.Uri.parse(this.currentDocumentState!.uri)))

			let editBlock = this.currentDocumentState.editBlocks.get(id)

			// If block doesn't exist, try to create it
			if (!editBlock) {
				editBlock = await this.addBlockToDocument(document, id, searchContent)
				if (!editBlock) {
					return false
				}
			}

			// Use the stored originalContent to find the range
			const currentContent = document.getText()
			let startIndex = currentContent.indexOf(editBlock.originalContent)

			let range: vscode.Range

			if (startIndex !== -1) {
				const startPos = document.positionAt(startIndex)
				const endPos = document.positionAt(startIndex + editBlock.originalContent.length)
				range = new vscode.Range(startPos, endPos)
			} else {
				// Use the last known range
				range = editBlock.matchedRange || editBlock.range
			}

			const workspaceEdit = new vscode.WorkspaceEdit()
			workspaceEdit.replace(document.uri, range, content, {
				label: "Inline Edit",
				needsConfirmation: false,
			})
			const didApplyCorrectly = await vscode.workspace.applyEdit(workspaceEdit, {
				isRefactoring: true,
			})
			if (!didApplyCorrectly) {
				console.error("Failed to apply final content")
			}

			const newEndPos = document.positionAt(document.offsetAt(range.start) + content.length)
			const newRange = new vscode.Range(range.start, newEndPos)

			const updatedBlock: EditBlock = {
				...editBlock,
				range: newRange,
				matchedRange: newRange,
				currentContent: content,
				finalContent: content,
				status: "final" as const,
			}

			this.currentDocumentState.editBlocks.set(id, updatedBlock)
			this.currentDocumentState.activeStreamingRanges.delete(id)
			this.currentDocumentState.activeMergeRanges.set(id, newRange)

			// Update decorations and scroll if editor is available
			const editor = await this.getOrCreateEditor()
			if (editor) {
				this.updateDecorations(editor)
				await this.scrollToRange(editor, newRange)
			}

			return true
		} catch (error) {
			console.error("Failed to apply final content:", error)
			return false
		}
	}

	/**
	 * This method takes an array of diffBlocks and applies them to the document, no matter the order or previous state, all in one write action.
	 * @param diffBlocks
	 * @returns boolean - true if all the diffBlocks were applied successfully
	 * @throws Error - if there is an error applying the diffBlocks
	 */
	public async forceFinalizeAll(
		diffBlocks: { id: string; searchContent: string; replaceContent: string }[]
	): Promise<boolean> {
		if (!this.currentDocumentState) {
			return false
		}
		try {
			const document =
				vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === this.currentDocumentState!.uri) ||
				(await vscode.workspace.openTextDocument(vscode.Uri.parse(this.currentDocumentState!.uri)))

			const workspaceEdit = new vscode.WorkspaceEdit()

			const currentContent = document.getText()

			// For each block, find the starting index of originalContent
			const blocksWithPositions: Array<{
				id: string
				searchContent: string
				replaceContent: string
				startIndex: number
				range: vscode.Range
			}> = []

			for (const block of diffBlocks) {
				const id = block.id
				const searchContent = block.searchContent
				const replaceContent = block.replaceContent

				let editBlock = this.currentDocumentState.editBlocks.get(id)

				// Use the stored originalContent to find the range
				let startIndex = currentContent.indexOf(editBlock?.originalContent || searchContent)

				let range: vscode.Range

				if (startIndex !== -1) {
					const startPos = document.positionAt(startIndex)
					const endPos = document.positionAt(
						startIndex + (editBlock?.originalContent.length || searchContent.length)
					)
					range = new vscode.Range(startPos, endPos)
				} else {
					// Use the last known range
					if (editBlock) {
						range = editBlock.matchedRange || editBlock.range
						startIndex = document.offsetAt(range.start)
					} else {
						console.error(`Could not find searchContent for block ${id}`)
						continue
					}
				}

				blocksWithPositions.push({ id, searchContent, replaceContent, startIndex, range })
			}

			// Sort blocks in descending order of startIndex
			blocksWithPositions.sort((a, b) => b.startIndex - a.startIndex)

			for (const block of blocksWithPositions) {
				workspaceEdit.replace(document.uri, block.range, block.replaceContent)

				// Update the editBlock
				const newEndPos = document.positionAt(block.startIndex + block.replaceContent.length)
				const newRange = new vscode.Range(block.range.start, newEndPos)

				const updatedBlock: EditBlock = {
					id: block.id,
					range: newRange,
					originalContent: block.searchContent,
					currentContent: block.replaceContent,
					finalContent: block.replaceContent,
					status: "final" as const,
					matchedRange: newRange,
				}
				this.currentDocumentState.editBlocks.set(block.id, updatedBlock)
				this.currentDocumentState.activeStreamingRanges.delete(block.id)
				this.currentDocumentState.activeMergeRanges.set(block.id, newRange)
			}

			const didApplyCorrectly = await vscode.workspace.applyEdit(workspaceEdit)
			if (!didApplyCorrectly) {
				console.error("Failed to apply workspace edits in forceFinalizeAll")
				return false
			}

			// Update decorations if editor is open
			const editor = await this.getOrCreateEditor()
			if (editor) {
				this.updateDecorations(editor)
			}

			return true
		} catch (error) {
			console.error("Failed to finalize all blocks:", error)
			throw error
		}
	}

	public async saveChanges(): Promise<{ finalContent: string }> {
		if (!this.currentDocumentState) {
			throw new Error("No active document")
		}

		try {
			const document =
				vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === this.currentDocumentState!.uri) ||
				(await vscode.workspace.openTextDocument(vscode.Uri.parse(this.currentDocumentState!.uri)))

			await document.save()

			const finalContent = document.getText()
			await this.dispose()

			return { finalContent }
		} catch (error) {
			console.error("Failed to save changes:", error)
			throw error
		}
	}

	public async rejectChanges(): Promise<boolean> {
		if (!this.currentDocumentState) {
			return false
		}

		try {
			const document =
				vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === this.currentDocumentState!.uri) ||
				(await vscode.workspace.openTextDocument(vscode.Uri.parse(this.currentDocumentState!.uri)))

			// Restore to the original file content
			const workspaceEdit = new vscode.WorkspaceEdit()
			const entireRange = new vscode.Range(0, 0, document.lineCount, 0)
			workspaceEdit.replace(document.uri, entireRange, this.currentDocumentState!.originalContent)
			await vscode.workspace.applyEdit(workspaceEdit)
			await document.save()

			// Clean up state
			await this.dispose()
			return true
		} catch (error) {
			console.error("Failed to reject changes:", error)
			return false
		}
	}

	private async getOrCreateEditor(): Promise<vscode.TextEditor | undefined> {
		if (!this.currentDocumentState) {
			return undefined
		}

		try {
			if (
				this.lastActiveEditor &&
				!this.lastActiveEditor.document.isClosed &&
				this.lastActiveEditor.document.uri.toString() === this.currentDocumentState.uri
			) {
				return this.lastActiveEditor
			}

			const doc =
				vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === this.currentDocumentState?.uri) ||
				(await vscode.workspace.openTextDocument(vscode.Uri.parse(this.currentDocumentState.uri)))

			const editor = await vscode.window.showTextDocument(doc)
			this.lastActiveEditor = editor
			return editor
		} catch (error) {
			console.error("Failed to get or create editor:", error)
			return undefined
		}
	}

	private updateDecorations(editor: vscode.TextEditor) {
		if (!this.currentDocumentState) {
			return
		}

		// Clear all decorations first
		editor.setDecorations(this.pendingDecoration, [])
		editor.setDecorations(this.streamingDecoration, [])
		editor.setDecorations(this.mergeDecoration, [])

		// Apply new decorations
		const pendingRanges = Array.from(this.currentDocumentState.activePendingRanges.values())
		const streamingRanges = Array.from(this.currentDocumentState.activeStreamingRanges.values())
		const mergeRanges = Array.from(this.currentDocumentState.activeMergeRanges.values())

		if (pendingRanges.length > 0) {
			editor.setDecorations(this.pendingDecoration, pendingRanges)
		}
		if (streamingRanges.length > 0) {
			editor.setDecorations(this.streamingDecoration, streamingRanges)
		}
		if (mergeRanges.length > 0) {
			editor.setDecorations(this.mergeDecoration, mergeRanges)
		}
	}

	private async scrollToRange(editor: vscode.TextEditor, range: vscode.Range) {
		if (!this.isAutoScrollEnabled) {
			return
		}

		const visibleRanges = editor.visibleRanges
		if (visibleRanges.length === 0) {
			return
		}

		const visibleLines = visibleRanges[0].end.line - visibleRanges[0].start.line
		const targetLine = Math.max(range.end.line - Math.floor(visibleLines * 0.7), 0)
		const targetRange = new vscode.Range(targetLine, 0, range.end.line, range.end.character)

		await editor.revealRange(targetRange, vscode.TextEditorRevealType.Default)

		const highlightDecoration = vscode.window.createTextEditorDecorationType({
			backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
			isWholeLine: true,
		})

		editor.setDecorations(highlightDecoration, [range])
		setTimeout(() => highlightDecoration.dispose(), 500)
	}

	public isOpen(): boolean {
		return (
			!!this.currentDocumentState && !!this.lastActiveEditor?.document && !this.lastActiveEditor.document.isClosed
		)
	}

	public setAutoScroll(enabled: boolean) {
		this.isAutoScrollEnabled = enabled
	}

	public dispose() {
		// Remove all decorations
		this.pendingDecoration.dispose()
		this.mergeDecoration.dispose()
		this.streamingDecoration.dispose()
		this.currentDocumentState = undefined
		this.lastActiveEditor = undefined
		this.disposables.forEach((d) => d.dispose())
	}

	public getVisibleRange(): vscode.Range | undefined {
		return this.lastActiveEditor?.visibleRanges[0]
	}

	public isRangeVisible(range: vscode.Range): boolean {
		const visibleRange = this.getVisibleRange()
		if (!visibleRange) {
			return false
		}
		return visibleRange.contains(range)
	}
}
