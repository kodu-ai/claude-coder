import * as vscode from "vscode"

// Keep existing interfaces but modify EditBlock and DocumentState
interface EditBlock {
	id: string
	range: vscode.Range
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
		this.setupEventListeners()
	}

	private setupEventListeners() {
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor(async (editor) => {
				if (editor && this.currentDocumentState?.uri === editor.document.uri.toString()) {
					await this.restoreDocumentState(editor)
				}
			})
		)
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

	private async restoreDocumentState(editor: vscode.TextEditor) {
		if (!this.currentDocumentState) {
			return
		}

		try {
			// Apply all active edits
			await editor.edit((editBuilder) => {
				for (const [, editBlock] of this.currentDocumentState!.editBlocks) {
					if (editBlock.status !== "pending") {
						editBuilder.replace(editBlock.range, editBlock.currentContent)
					}
				}
			})

			this.updateDecorations(editor)
			this.lastActiveEditor = editor
		} catch (error) {
			console.error("Failed to restore document state:", error)
		}
	}

	// Modified open method to be more focused on initialization
	public async open(id: string, filePath: string, searchContent: string): Promise<boolean> {
		try {
			const document = await vscode.workspace.openTextDocument(filePath)
			const editor = await vscode.window.showTextDocument(document)
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
			const block = await this.addBlock(editor, id, searchContent)
			if (!block) {
				return false
			}
			return true
		} catch (error) {
			console.error("Failed to open document:", error)
			return false
		}
	}
	private async addBlock(
		editor: vscode.TextEditor,
		id: string,
		searchContent: string
	): Promise<EditBlock | undefined> {
		if (!this.currentDocumentState) {
			return undefined
		}

		try {
			const document = editor.document
			const currentContent = document.getText()
			const startIndex = currentContent.indexOf(searchContent)

			if (startIndex === -1) {
				console.warn(`Could not find searchContent for block ${id}`)
				return undefined
			}

			const startPos = document.positionAt(startIndex)
			const endPos = document.positionAt(startIndex + searchContent.length)
			const range = new vscode.Range(startPos, endPos)

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
			const editor = await this.getOrCreateEditor()
			if (!editor) {
				return false
			}

			let editBlock = this.currentDocumentState.editBlocks.get(id)

			// If block doesn't exist, try to create it
			if (!editBlock) {
				editBlock = await this.addBlock(editor, id, searchContent)
				if (!editBlock) {
					return false
				}
			}

			// confirm that the content actually changed
			if (editBlock.currentContent === content) {
				console.log(`Content for block ${id} is the same, skipping... this update`)
				return true
			}

			await editor.edit(
				(editBuilder) => {
					editBuilder.replace(editBlock!.range, content)
				},
				{
					undoStopBefore: !this.isFirstEditTouched,
					undoStopAfter: false,
				}
			)
			this.isFirstEditTouched = true

			const newEndPos = editor.document.positionAt(
				editor.document.offsetAt(editBlock.range.start) + content.length
			)
			const newRange = new vscode.Range(editBlock.range.start, newEndPos)

			const updatedBlock = {
				...editBlock,
				range: newRange,
				currentContent: content,
				status: "streaming" as const,
			}

			this.currentDocumentState.editBlocks.set(id, updatedBlock)
			this.currentDocumentState.activePendingRanges.delete(id)
			this.currentDocumentState.activeStreamingRanges.set(id, newRange)

			this.updateDecorations(editor)
			await this.scrollToRange(editor, newRange)

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
			const editor = await this.getOrCreateEditor()
			if (!editor) {
				return false
			}

			let editBlock = this.currentDocumentState.editBlocks.get(id)

			// If block doesn't exist, try to create it
			if (!editBlock) {
				editBlock = await this.addBlock(editor, id, searchContent)
				if (!editBlock) {
					return false
				}
			}

			await editor.edit(
				(editBuilder) => {
					editBuilder.replace(editBlock!.range, content)
				},
				{
					undoStopBefore: !this.isFirstEditTouched,
					undoStopAfter: false,
				}
			)
			this.isFirstEditTouched = true

			const newEndPos = editor.document.positionAt(
				editor.document.offsetAt(editBlock.range.start) + content.length
			)
			const newRange = new vscode.Range(editBlock.range.start, newEndPos)

			const updatedBlock = {
				...editBlock,
				range: newRange,
				currentContent: content,
				finalContent: content,
				status: "final" as const,
			}

			this.currentDocumentState.editBlocks.set(id, updatedBlock)
			this.currentDocumentState.activeStreamingRanges.delete(id)
			this.currentDocumentState.activeMergeRanges.set(id, newRange)

			this.updateDecorations(editor)
			await this.scrollToRange(editor, newRange)

			return true
		} catch (error) {
			console.error("Failed to apply final content:", error)
			return false
		}
	}

	public async saveChanges(): Promise<{ finalContent: string }> {
		if (!this.currentDocumentState) {
			throw new Error("No active document")
		}

		try {
			const editor = await this.getOrCreateEditor()
			if (!editor) {
				throw new Error("Could not access editor")
			}

			// Focus the editor
			await vscode.window.showTextDocument(editor.document)

			// Apply all final changes
			await editor.edit(
				(editBuilder) => {
					const currentContent = editor.document.getText()
					const blocks = Array.from(this.currentDocumentState!.editBlocks.values())
						.filter((block) => block.status === "final" && block.finalContent)
						.sort((a, b) => {
							const aStart = currentContent.indexOf(a.originalContent)
							const bStart = currentContent.indexOf(b.originalContent)
							return aStart - bStart
						})

					for (const block of blocks) {
						if (block.finalContent) {
							const startIndex = currentContent.indexOf(block.originalContent)
							if (startIndex !== -1) {
								const startPos = editor.document.positionAt(startIndex)
								const endPos = editor.document.positionAt(startIndex + block.originalContent.length)
								editBuilder.replace(new vscode.Range(startPos, endPos), block.finalContent)
							}
						}
					}
				},
				{
					undoStopBefore: true,
					undoStopAfter: true,
				}
			)

			// Save the document
			await editor.document.save()

			// Get final content and clean up
			const finalContent = editor.document.getText()
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
			const editor = await this.getOrCreateEditor()
			if (!editor) {
				return false
			}

			// Focus the editor
			await vscode.window.showTextDocument(editor.document)

			// Restore to the original file content
			await editor.edit(
				(editBuilder) => {
					const entireContent = editor.document.getText()
					const originalContent = this.currentDocumentState!.originalContent
					editBuilder.replace(new vscode.Range(0, 0, editor.document.lineCount, 0), originalContent)
				},
				{
					undoStopBefore: true,
					undoStopAfter: true,
				}
			)
			await editor.document.save()

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
			if (this.lastActiveEditor?.document.uri.toString() === this.currentDocumentState.uri) {
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
		// remove all decorations
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
