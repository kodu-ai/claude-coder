import * as vscode from "vscode"
import { diff_match_patch } from "diff-match-patch"

interface EditBlock {
	id: string
	startOffset: number
	endOffset: number
	originalContent: string
	currentContent: string
	finalContent?: string
	status: "pending" | "streaming" | "final"
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
		const text = document.getText()
		const MAX_PATTERN_LENGTH = 32

		if (searchContent.length <= MAX_PATTERN_LENGTH) {
			// Use diff_match_patch for small patterns
			const dmp = new diff_match_patch()
			dmp.Match_Threshold = 0.1 // Set a low threshold for high accuracy
			dmp.Match_Distance = 2000 // Adjust as needed

			const loc = 0 // Start location

			const matchIndex = dmp.match_main(text, searchContent, loc)

			if (matchIndex !== -1) {
				const startPos = document.positionAt(matchIndex)
				const endPos = document.positionAt(matchIndex + searchContent.length)
				return new vscode.Range(startPos, endPos)
			}
		} else {
			// For longer patterns, use indexOf for exact match
			const matchIndex = text.indexOf(searchContent)
			if (matchIndex !== -1) {
				const startPos = document.positionAt(matchIndex)
				const endPos = document.positionAt(matchIndex + searchContent.length)
				return new vscode.Range(startPos, endPos)
			}

			// If exact match not found, attempt to find approximate match
			// Split searchContent into smaller chunks and search for the best matching chunk
			const chunks = this.splitIntoChunks(searchContent, MAX_PATTERN_LENGTH)

			for (const chunk of chunks) {
				const chunkMatchIndex = text.indexOf(chunk)
				if (chunkMatchIndex !== -1) {
					const startPos = document.positionAt(chunkMatchIndex)
					const endPos = document.positionAt(chunkMatchIndex + searchContent.length)
					return new vscode.Range(startPos, endPos)
				}
			}
		}

		return undefined // No match found
	}

	private splitIntoChunks(str: string, chunkSize: number): string[] {
		const chunks = []
		for (let i = 0; i <= str.length - chunkSize; i++) {
			chunks.push(str.substring(i, i + chunkSize))
		}
		return chunks
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
			let startOffset: number | undefined

			// First, try to find an exact match
			startOffset = currentContent.indexOf(searchContent)

			if (startOffset === -1) {
				// Perform fuzzy matching
				const range = this.findBestMatchingRange(document, searchContent)
				if (range) {
					startOffset = document.offsetAt(range.start)
				} else {
					console.warn(`Could not find searchContent for block ${id}`)
					return undefined
				}
			}

			const endOffset = startOffset + searchContent.length

			// Check for overlapping blocks
			for (const [, existingBlock] of this.currentDocumentState.editBlocks) {
				if (
					(startOffset >= existingBlock.startOffset && startOffset < existingBlock.endOffset) ||
					(endOffset > existingBlock.startOffset && endOffset <= existingBlock.endOffset)
				) {
					console.warn(`Block ${id} would overlap with existing block`)
					return undefined
				}
			}

			const editBlock: EditBlock = {
				id,
				startOffset,
				endOffset,
				originalContent: searchContent,
				currentContent: searchContent,
				status: "pending",
			}

			this.currentDocumentState.editBlocks.set(id, editBlock)
			this.currentDocumentState.activePendingRanges.set(
				id,
				new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset))
			)

			// Update decorations if editor is available
			const editor = await this.getOrCreateEditor()
			if (editor) {
				this.updateDecorations(editor)
			}

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
			const document = await this.getDocument()
			if (!document) {
				console.error("No active document to apply stream content.")
				return false
			}

			let editBlock = this.currentDocumentState.editBlocks.get(id)

			if (!editBlock) {
				editBlock = await this.addBlockToDocument(document, id, searchContent)
				if (!editBlock) {
					return false
				}
			}

			// Recalculate range from offsets
			let startOffset = editBlock.startOffset
			let endOffset = editBlock.endOffset
			let range = new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset))

			// Ensure content at range matches expected content
			const rangeContent = document.getText(range)
			if (rangeContent !== editBlock.currentContent) {
				// Handle mismatch, possibly re-search for content
				console.error(`Content mismatch for block ${id}`)
				return false
			}

			// Apply edit using WorkspaceEdit
			const workspaceEdit = new vscode.WorkspaceEdit()
			workspaceEdit.replace(document.uri, range, content)
			const success = await vscode.workspace.applyEdit(workspaceEdit)

			if (!success) {
				console.error("Failed to apply streaming content")
				return false
			}

			// Update the edit block's offsets and content
			const newEndOffset = startOffset + content.length
			const lengthDifference = content.length - (endOffset - startOffset)
			editBlock.endOffset = newEndOffset
			editBlock.currentContent = content
			editBlock.status = "streaming"

			this.currentDocumentState.editBlocks.set(id, editBlock)
			this.currentDocumentState.activePendingRanges.delete(id)
			this.currentDocumentState.activeStreamingRanges.set(
				id,
				new vscode.Range(document.positionAt(startOffset), document.positionAt(newEndOffset))
			)

			// Adjust offsets of subsequent blocks
			this.adjustSubsequentOffsets(id, lengthDifference)

			// Update decorations and scroll if editor is available
			const editor = vscode.window.visibleTextEditors.find(
				(e) => e.document.uri.toString() === document.uri.toString()
			)
			if (editor) {
				this.updateDecorations(editor)
				await this.scrollToRange(
					editor,
					new vscode.Range(document.positionAt(startOffset), document.positionAt(newEndOffset))
				)
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
			const document = await this.getDocument()
			if (!document) {
				console.error("No active document to apply final content.")
				return false
			}

			let editBlock = this.currentDocumentState.editBlocks.get(id)

			// If block doesn't exist, try to create it
			if (!editBlock) {
				editBlock = await this.addBlockToDocument(document, id, searchContent)
				if (!editBlock) {
					return false
				}
			}

			// Recalculate range from offsets
			let startOffset = editBlock.startOffset
			let endOffset = editBlock.endOffset
			let range = new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset))

			// Ensure content at range matches expected content
			const rangeContent = document.getText(range)
			if (rangeContent !== editBlock.currentContent) {
				console.warn(`Content at range for block ${id} does not match expected content.`)
				// Try to find the correct range again
				const newRange = this.findBestMatchingRange(document, editBlock.currentContent)
				if (newRange) {
					startOffset = document.offsetAt(newRange.start)
					endOffset = document.offsetAt(newRange.end)
					editBlock.startOffset = startOffset
					editBlock.endOffset = endOffset
					range = newRange
				} else {
					console.error(`Could not find matching content for block ${id}`)
					return false
				}
			}

			// Apply edit using WorkspaceEdit
			const workspaceEdit = new vscode.WorkspaceEdit()
			workspaceEdit.replace(document.uri, range, content)
			const success = await vscode.workspace.applyEdit(workspaceEdit)

			if (!success) {
				console.error("Failed to apply final content")
				return false
			}

			// Update the edit block's offsets and content
			const newEndOffset = startOffset + content.length
			const lengthDifference = content.length - (endOffset - startOffset)
			editBlock.endOffset = newEndOffset
			editBlock.currentContent = content
			editBlock.finalContent = content
			editBlock.status = "final"

			this.currentDocumentState.editBlocks.set(id, editBlock)
			this.currentDocumentState.activeStreamingRanges.delete(id)
			this.currentDocumentState.activeMergeRanges.set(
				id,
				new vscode.Range(document.positionAt(startOffset), document.positionAt(newEndOffset))
			)

			// Adjust offsets of subsequent blocks
			this.adjustSubsequentOffsets(id, lengthDifference)

			// Update decorations and scroll if editor is available
			const editor = vscode.window.visibleTextEditors.find(
				(e) => e.document.uri.toString() === document.uri.toString()
			)
			if (editor) {
				this.updateDecorations(editor)
				await this.scrollToRange(
					editor,
					new vscode.Range(document.positionAt(startOffset), document.positionAt(newEndOffset))
				)
			}

			return true
		} catch (error) {
			console.error("Failed to apply final content:", error)
			return false
		}
	}

	/**
	 * This method takes an array of diffBlocks and applies them to the document, ensuring that ranges are updated correctly after each edit.
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
			const document = await this.getDocument()
			if (!document) {
				console.error("No active document to finalize all blocks.")
				return false
			}

			// Apply edits from the end of the document to the start
			const blocks = diffBlocks.slice().sort((a, b) => {
				const startOffsetA = this.currentDocumentState!.editBlocks.get(a.id)?.startOffset || 0
				const startOffsetB = this.currentDocumentState!.editBlocks.get(b.id)?.startOffset || 0
				return startOffsetB - startOffsetA // Sort in reverse order
			})

			for (const block of blocks) {
				const editBlock = this.currentDocumentState!.editBlocks.get(block.id)
				if (!editBlock) {
					console.error(`Edit block ${block.id} not found.`)
					continue
				}

				let startOffset = editBlock.startOffset
				let endOffset = editBlock.endOffset
				let range = new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset))

				const rangeContent = document.getText(range)
				if (rangeContent !== editBlock.currentContent) {
					const newRange = this.findBestMatchingRange(document, editBlock.currentContent)
					if (newRange) {
						startOffset = document.offsetAt(newRange.start)
						endOffset = document.offsetAt(newRange.end)
						editBlock.startOffset = startOffset
						editBlock.endOffset = endOffset
						range = newRange
					} else {
						console.error(`Could not find matching content for block ${block.id}`)
						continue
					}
				}

				// Apply edit using WorkspaceEdit
				const workspaceEdit = new vscode.WorkspaceEdit()
				workspaceEdit.replace(document.uri, range, block.replaceContent)
				const success = await vscode.workspace.applyEdit(workspaceEdit)

				if (!success) {
					console.error("Failed to apply edits in forceFinalizeAll")
					return false
				}

				// Update the edit block's offsets and content
				const newEndOffset = startOffset + block.replaceContent.length
				const lengthDifference = block.replaceContent.length - (endOffset - startOffset)
				editBlock.endOffset = newEndOffset
				editBlock.currentContent = block.replaceContent
				editBlock.finalContent = block.replaceContent
				editBlock.status = "final"

				this.currentDocumentState!.editBlocks.set(block.id, editBlock)
				this.currentDocumentState!.activeStreamingRanges.delete(block.id)
				this.currentDocumentState!.activeMergeRanges.set(
					block.id,
					new vscode.Range(document.positionAt(startOffset), document.positionAt(newEndOffset))
				)

				// Adjust offsets of subsequent blocks
				this.adjustSubsequentOffsets(block.id, lengthDifference)
			}

			// Update decorations
			const editor = vscode.window.visibleTextEditors.find(
				(e) => e.document.uri.toString() === document.uri.toString()
			)
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
			const document = await this.getDocument()
			if (!document) {
				console.error("No active document to save changes.")
				throw new Error("No active document to save changes.")
			}

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
			const document = await this.getDocument()
			if (!document) {
				console.error("No active document to reject changes.")
				return false
			}

			// Restore to the original file content
			const entireRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))

			const workspaceEdit = new vscode.WorkspaceEdit()
			workspaceEdit.replace(document.uri, entireRange, this.currentDocumentState.originalContent)
			const success = await vscode.workspace.applyEdit(workspaceEdit)

			if (!success) {
				console.error("Failed to reject changes")
				return false
			}

			await document.save()

			// Clean up state
			await this.dispose()
			return true
		} catch (error) {
			console.error("Failed to reject changes:", error)
			return false
		}
	}

	private async getDocument(): Promise<vscode.TextDocument | undefined> {
		if (!this.currentDocumentState) {
			return undefined
		}

		try {
			const uri = vscode.Uri.parse(this.currentDocumentState.uri)
			let document = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString())
			if (!document) {
				document = await vscode.workspace.openTextDocument(uri)
			}
			return document
		} catch (error) {
			console.error("Failed to get document:", error)
			return undefined
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

			const editor = await vscode.window.showTextDocument(doc, {
				viewColumn: vscode.ViewColumn.Active,
				preserveFocus: false,
				preview: false,
			})
			this.lastActiveEditor = editor
			return editor
		} catch (error) {
			console.error("Failed to get or create editor:", error)
			return undefined
		}
	}

	private adjustSubsequentOffsets(changedBlockId: string, lengthDifference: number) {
		if (!this.currentDocumentState) {
			return
		}

		let blockFound = false
		for (const [id, block] of [...this.currentDocumentState.editBlocks.entries()].sort(
			(a, b) => a[1].startOffset - b[1].startOffset
		)) {
			if (id === changedBlockId) {
				blockFound = true
				continue
			}
			if (blockFound) {
				block.startOffset += lengthDifference
				block.endOffset += lengthDifference
			}
		}
	}

	private updateDecorations(editor: vscode.TextEditor) {
		if (!this.currentDocumentState) {
			return
		}

		const document = editor.document

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
