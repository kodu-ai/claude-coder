import * as vscode from "vscode"

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
}

export class InlineEditHandler {
	private pendingDecoration: vscode.TextEditorDecorationType
	private streamingDecoration: vscode.TextEditorDecorationType
	private mergeDecoration: vscode.TextEditorDecorationType
	private isAutoScrollEnabled: boolean = true
	private currentDocumentState: DocumentState | undefined
	private documentReadyPromise: Promise<void> | undefined
	private maxRetries: number = 5
	private retryDelay: number = 100 // ms

	constructor() {
		this.pendingDecoration = this.createDecoration("⟳ Pending changes", "editorGhostText.foreground")
		this.streamingDecoration = this.createDecoration("↻ Streaming changes...", "editorInfo.foreground")
		this.mergeDecoration = this.createDecoration("⚡ Review changes", "editorInfo.foreground")
	}

	private async waitForDocumentReady(uri: string): Promise<vscode.TextDocument> {
		let retries = 0
		while (retries < this.maxRetries) {
			const document = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString())
			const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString())

			if (document && editor) {
				this.documentReadyPromise = undefined
				this.currentDocumentState = {
					uri: uri.toString(),
					originalContent: document.getText(),
					currentContent: document.getText(),
					editBlocks: new Map(),
				}
				return document
			}

			await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
			retries++
		}

		throw new Error("Document failed to become ready after multiple attempts")
	}

	public async open(id: string, filePath: string, searchContent: string): Promise<boolean> {
		try {
			// Create URI first so we can use it consistently
			const uri = vscode.Uri.parse(filePath)

			// Start document opening process
			const openingDocument = await vscode.workspace.openTextDocument(filePath)

			// Initialize state early with basic info
			this.currentDocumentState = {
				uri: uri.toString(),
				originalContent: openingDocument.getText(),
				currentContent: openingDocument.getText(),
				editBlocks: new Map(),
			}

			// Show the document and wait for it to be ready
			this.documentReadyPromise = (async () => {
				await vscode.window.showTextDocument(openingDocument, {
					viewColumn: vscode.ViewColumn.Active,
					preserveFocus: false,
					preview: false,
				})

				// Wait for document to be fully ready in editor
				await this.waitForDocumentReady(uri.toString())
			})()

			// Wait for the document to be ready
			await this.documentReadyPromise

			// Initialize the first edit block
			this.currentDocumentState.editBlocks.set(id, {
				id,
				searchContent,
				currentContent: searchContent,
				status: "pending",
			})

			await this.refreshEditor()
			return true
		} catch (error) {
			this.logger(`Failed to open document: ${error}`, "error")
			// Clean up state on failure
			this.currentDocumentState = undefined
			this.documentReadyPromise = undefined
			return false
		}
	}

	private createDecoration(text: string, color: string): vscode.TextEditorDecorationType {
		return vscode.window.createTextEditorDecorationType({
			isWholeLine: true,
			backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
			after: {
				margin: "0 0 0 1em",
				contentText: text,
				color: new vscode.ThemeColor(color),
			},
			before: {
				margin: "0 0 0 1em",
			},
			light: {
				backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
				before: {
					color: new vscode.ThemeColor("editor.foreground"),
				},
			},
			dark: {
				backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
				before: {
					color: new vscode.ThemeColor("editor.foreground"),
				},
			},
		})
	}

	private async scrollToRange(editor: vscode.TextEditor, range: vscode.Range) {
		if (!this.isAutoScrollEnabled) {
			return
		}

		try {
			const visibleRanges = editor.visibleRanges
			if (visibleRanges.length === 0) {
				return
			}

			// Calculate visible range size
			const visibleLines = visibleRanges[0].end.line - visibleRanges[0].start.line

			// Position the edited range in the center-bottom of the viewport
			// Try to show a few lines of context above the edit
			const contextLines = Math.min(10, Math.floor(visibleLines * 0.3))
			const targetLine = Math.max(0, range.end.line - Math.floor(visibleLines * 0.7))

			// Create a range that includes context
			const revealRange = new vscode.Range(
				new vscode.Position(targetLine, 0),
				new vscode.Position(range.end.line + contextLines, range.end.character)
			)

			// Reveal with smooth scrolling
			await editor.revealRange(revealRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport)

			// Add a temporary highlight effect
			const highlightDecoration = vscode.window.createTextEditorDecorationType({
				backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
				borderColor: new vscode.ThemeColor("editor.findMatchBorder"),
				borderWidth: "1px",
				borderStyle: "solid",
				isWholeLine: true,
			})

			editor.setDecorations(highlightDecoration, [range])

			// Remove highlight after a short delay
			setTimeout(() => highlightDecoration.dispose(), 800)
		} catch (error) {
			console.error("Failed to scroll to range:", error)
		}
	}

	public async applyStreamContent(id: string, searchContent: string, content: string): Promise<boolean> {
		await this.documentReadyPromise
		if (!this.currentDocumentState) {
			this.logger("[applyStreamContent] No active document", "error")
			throw new Error(`No active document found when calling applyStreamContent`)
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

			// Update block content
			block.currentContent = content
			block.status = "streaming"

			// Update entire file content
			await this.updateFileContent()
			return true
		} catch (error) {
			console.error("Failed to apply streaming content:", error)
			return false
		}
	}

	public async applyFinalContent(id: string, searchContent: string, content: string): Promise<boolean> {
		await this.documentReadyPromise

		if (!this.currentDocumentState) {
			this.logger("[applyFinalContent] No active document", "error")
			throw new Error(`No active document found when calling applyFinalContent`)
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

			// Update block content
			block.currentContent = content
			block.finalContent = content
			block.status = "final"

			// Update entire file content
			await this.updateFileContent()
			return true
		} catch (error) {
			console.error("Failed to apply final content:", error)
			return false
		}
	}

	private async updateFileContent(): Promise<boolean> {
		await this.documentReadyPromise

		if (!this.currentDocumentState) {
			this.logger("[updateFileContent] No active document", "error")
			throw new Error(`No active document found when calling updateFileContent`)
		}

		try {
			const document = await this.getDocument()
			if (!document) {
				return false
			}

			// Start with original content
			let newContent = this.currentDocumentState.originalContent

			// Apply all blocks in order
			const sortedBlocks = Array.from(this.currentDocumentState.editBlocks.values()).sort((a, b) => {
				const indexA = newContent.indexOf(a.searchContent)
				const indexB = newContent.indexOf(b.searchContent)
				return indexA - indexB
			})

			for (const block of sortedBlocks) {
				newContent = newContent.replace(block.searchContent, block.currentContent)
			}

			// Update entire file
			const entireRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))

			const workspaceEdit = new vscode.WorkspaceEdit()
			workspaceEdit.replace(document.uri, entireRange, newContent)
			const success = await vscode.workspace.applyEdit(workspaceEdit)

			if (success) {
				this.currentDocumentState.currentContent = newContent
				await this.refreshEditor()
			}

			return success
		} catch (error) {
			console.error("Failed to update file content:", error)
			return false
		}
	}

	private async refreshEditor(): Promise<void> {
		await this.documentReadyPromise
		if (!this.currentDocumentState) {
			this.logger("[refreshEditor] No active document", "error")
			throw new Error(`No active document found when calling refreshEditor`)
		}

		const document = await this.getDocument()
		if (!document) {
			return
		}

		const editor = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.toString() === document.uri.toString()
		)

		if (editor) {
			// Clear existing decorations
			editor.setDecorations(this.pendingDecoration, [])
			editor.setDecorations(this.streamingDecoration, [])
			editor.setDecorations(this.mergeDecoration, [])

			// Group ranges by status
			const pendingRanges: vscode.Range[] = []
			const streamingRanges: vscode.Range[] = []
			const mergeRanges: vscode.Range[] = []

			// Apply new decorations based on block status
			for (const block of this.currentDocumentState.editBlocks.values()) {
				const searchIndex = document.getText().indexOf(block.currentContent)
				if (searchIndex !== -1) {
					const range = new vscode.Range(
						document.positionAt(searchIndex),
						document.positionAt(searchIndex + block.currentContent.length)
					)

					switch (block.status) {
						case "pending":
							pendingRanges.push(range)
							break
						case "streaming":
							streamingRanges.push(range)
							break
						case "final":
							mergeRanges.push(range)
							break
					}

					// Only scroll to streaming or final changes
					if ((block.status === "streaming" || block.status === "final") && this.isAutoScrollEnabled) {
						await this.scrollToRange(editor, range)
					}
				}
			}

			// Apply all decorations at once for better performance
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
	}

	public async forceFinalizeAll(
		diffBlocks: { id: string; searchContent: string; replaceContent: string }[]
	): Promise<boolean> {
		if (!this.currentDocumentState) {
			return false
		}
		// let's open the document and make it focused and active
		vscode.window.showTextDocument(vscode.Uri.parse(this.currentDocumentState.uri), {
			viewColumn: vscode.ViewColumn.Active,
			preserveFocus: false,
			preview: false,
		})

		try {
			// Update all blocks to final state
			for (const block of diffBlocks) {
				const existingBlock = this.currentDocumentState.editBlocks.get(block.id)
				if (existingBlock) {
					existingBlock.currentContent = block.replaceContent
					existingBlock.finalContent = block.replaceContent
					existingBlock.status = "final"
				} else {
					this.currentDocumentState.editBlocks.set(block.id, {
						id: block.id,
						searchContent: block.searchContent,
						currentContent: block.replaceContent,
						finalContent: block.replaceContent,
						status: "final",
					})
				}
			}

			// Update entire file content
			return await this.updateFileContent()
		} catch (error) {
			console.error("Failed to finalize all blocks:", error)
			return false
		}
	}

	private async getDocument(): Promise<vscode.TextDocument | undefined> {
		await this.documentReadyPromise

		if (!this.currentDocumentState) {
			this.logger("[getDocument] No active document", "error")
			throw new Error(`No active document found when calling getDocument`)
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

	public async saveChanges(): Promise<{ finalContent: string }> {
		await this.documentReadyPromise
		if (!this.currentDocumentState) {
			throw new Error("No active document to save changes.")
		}

		try {
			const document = await this.getDocument()
			if (!document) {
				throw new Error("No active document to save changes.")
			}

			// We don't want to override any user changes made after our last edit
			// So we'll just save whatever is currently in the document
			await document.save()

			// Get the current content which might include user changes
			const finalContent = document.getText()

			// Clean up
			this.dispose()

			return { finalContent }
		} catch (error) {
			console.error("Failed to save changes:", error)
			throw error
		}
	}

	public async rejectChanges(): Promise<boolean> {
		await this.documentReadyPromise

		if (!this.currentDocumentState) {
			this.logger("[rejectChanges] No active document", "error")
			throw new Error(`No active document found when calling rejectChanges`)
		}

		try {
			const document = await this.getDocument()
			if (!document) {
				return false
			}

			// Always restore to the original content from when we first opened the file
			const workspaceEdit = new vscode.WorkspaceEdit()
			workspaceEdit.replace(
				document.uri,
				new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
				this.currentDocumentState.originalContent
			)

			const success = await vscode.workspace.applyEdit(workspaceEdit)
			if (success) {
				// Make sure to save after rejecting
				await document.save()

				// Clean up
				this.dispose()
			}
			return success
		} catch (error) {
			console.error("Failed to reject changes:", error)
			return false
		}
	}

	public isOpen(): boolean {
		this.logger(`isOpen: ${!!this.currentDocumentState}`)
		return !!this.currentDocumentState
	}

	public setAutoScroll(enabled: boolean) {
		this.isAutoScrollEnabled = enabled
	}

	public dispose() {
		this.logger("Disposing InlineEditHandler")
		this.pendingDecoration.dispose()
		this.streamingDecoration.dispose()
		this.mergeDecoration.dispose()
		// this.currentDocumentState = undefined

		// Force garbage collection of any remaining decorations
		if (vscode.window.activeTextEditor) {
			this.pendingDecoration.dispose()
			this.streamingDecoration.dispose()
			this.mergeDecoration.dispose()
		}
	}

	private logger(message: string, level: "info" | "warn" | "error" = "info") {
		console[level](`[InlineEditHandler] ${message}`)
	}
}
