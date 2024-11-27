import * as vscode from "vscode"

export const CONSTANTS = {
	DIFF_VIEW_URI_SCHEME: "claude-coder-diff",
	MODIFIED_URI_SCHEME: "claude-coder-modified",
} as const

interface DocumentState {
	uri: string
	originalContent: string
	currentContent: string
	isStreaming: boolean
	autoScroll: boolean
	editedBlocks: Array<{
		start: number
		end: number
		content: string
		timestamp: number
	}>
	lastEditLine: number
}

interface EditBlock {
	start: number
	end: number
	content: string
	timestamp: number
}

export class FullFileEditor {
	private originalContentDecoration: vscode.TextEditorDecorationType
	private newContentDecoration: vscode.TextEditorDecorationType
	private currentDocumentState: DocumentState | undefined
	private documentReadyPromise: Promise<void> | undefined
	private maxRetries: number = 5
	private retryDelay: number = 100

	constructor() {
		// Enhanced decorations with more distinct colors and better visibility
		this.originalContentDecoration = this.createDecoration({
			text: "⚡ Previous content",
			backgroundColor: new vscode.ThemeColor("diffEditor.removedTextBackground"),
			borderColor: new vscode.ThemeColor("errorForeground"),
			textColor: new vscode.ThemeColor("errorForeground"),
		})

		this.newContentDecoration = this.createDecoration({
			text: "✨ New content",
			backgroundColor: new vscode.ThemeColor("diffEditor.insertedTextBackground"),
			borderColor: new vscode.ThemeColor("gitDecoration.addedResourceForeground"),
			textColor: new vscode.ThemeColor("gitDecoration.addedResourceForeground"),
		})
	}

	private createDecoration({
		text,
		backgroundColor,
		borderColor,
		textColor,
	}: {
		text: string
		backgroundColor: vscode.ThemeColor
		borderColor: vscode.ThemeColor
		textColor: vscode.ThemeColor
	}): vscode.TextEditorDecorationType {
		return vscode.window.createTextEditorDecorationType({
			isWholeLine: true,
			backgroundColor,
			borderColor,
			borderStyle: "solid",
			borderWidth: "0 0 0 4px", // Thicker border for better visibility
			before: {
				contentText: "▌", // Left marker
				color: borderColor,
				margin: "0 0.5em 0 0.2em",
			},
			after: {
				contentText: `${text} `, // Added space after text
				color: textColor,
				fontWeight: "bold",
				fontStyle: "italic",
				margin: "0 0 0 1em",
			},
			light: {
				after: {
					color: textColor,
				},
				before: {
					color: borderColor,
				},
			},
			dark: {
				after: {
					color: textColor,
				},
				before: {
					color: borderColor,
				},
			},
		})
	}

	get originalContent() {
		return this.currentDocumentState?.originalContent
	}

	private async waitForDocumentReady(uri: string): Promise<vscode.TextDocument> {
		let retries = 0
		while (retries < this.maxRetries) {
			const document = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString())
			const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString())

			if (document && editor) {
				this.documentReadyPromise = undefined
				return document
			}

			await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
			retries++
		}

		throw new Error("Document failed to become ready after multiple attempts")
	}

	private async scrollToRange(editor: vscode.TextEditor, range: vscode.Range): Promise<void> {
		if (!this.currentDocumentState?.autoScroll) {
			return
		}

		try {
			const document = editor.document
			const lastLine = range.end.line
			const lineCount = document.lineCount

			// Always ensure the last edited line is fully visible
			const visibleRange = new vscode.Range(
				new vscode.Position(lastLine, 0),
				new vscode.Position(lastLine, document.lineAt(lastLine).text.length)
			)

			// First, reveal the exact line being edited
			await editor.revealRange(visibleRange, vscode.TextEditorRevealType.InCenter)

			// Create a temporary highlight decoration
			const highlightDecoration = vscode.window.createTextEditorDecorationType({
				backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
				borderColor: new vscode.ThemeColor("editor.findMatchBorder"),
				borderWidth: "2px",
				borderStyle: "solid",
				isWholeLine: true,
				after: {
					contentText: "✨ Current edit",
					color: new vscode.ThemeColor("editorInfo.foreground"),
					fontWeight: "bold",
					margin: "0 0 0 2em",
				},
			})

			// Apply the highlight decoration
			editor.setDecorations(highlightDecoration, [visibleRange])

			// Keep highlight visible for a moment longer
			await new Promise((resolve) => setTimeout(resolve, 800))
			highlightDecoration.dispose()
		} catch (error) {
			console.error("Failed to scroll to range:", error)
		}
	}

	public async open(filePath: string): Promise<boolean> {
		try {
			const uri = vscode.Uri.parse(filePath)
			let document: vscode.TextDocument

			try {
				document = await vscode.workspace.openTextDocument(uri)
			} catch (error) {
				const workspaceEdit = new vscode.WorkspaceEdit()
				workspaceEdit.createFile(uri, { ignoreIfExists: true })
				await vscode.workspace.applyEdit(workspaceEdit)
				document = await vscode.workspace.openTextDocument(uri)
			}

			this.currentDocumentState = {
				uri: uri.toString(),
				originalContent: document.getText(),
				currentContent: document.getText(),
				isStreaming: false,
				autoScroll: true,
				editedBlocks: [],
				lastEditLine: 0,
			}

			this.documentReadyPromise = (async () => {
				await vscode.window.showTextDocument(document, {
					viewColumn: vscode.ViewColumn.Active,
					preserveFocus: false,
					preview: false,
				})
				await this.waitForDocumentReady(uri.toString())
			})()

			await this.documentReadyPromise
			await this.refreshEditor()
			return true
		} catch (error) {
			console.error("Failed to open document:", error)
			this.currentDocumentState = undefined
			this.documentReadyPromise = undefined
			return false
		}
	}

	public async applyStreamContent(content: string): Promise<boolean> {
		await this.documentReadyPromise
		if (!this.currentDocumentState) {
			throw new Error("No active document")
		}

		try {
			const document = await this.getDocument()
			if (!document) return false

			const editor = vscode.window.activeTextEditor
			if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
				return false
			}

			this.currentDocumentState.isStreaming = true

			// Split content into lines for comparison
			const newLines = content.split("\n")
			const currentLines = document.getText().split("\n")

			// First, ensure the document shows the original content with decorations
			if (!this.currentDocumentState.currentContent) {
				this.currentDocumentState.currentContent = document.getText()
				await this.refreshEditor()
			}

			// Process line by line changes
			for (let i = 0; i < newLines.length; i++) {
				if (i >= currentLines.length || currentLines[i] !== newLines[i]) {
					// Create a workspace edit for this line
					const workspaceEdit = new vscode.WorkspaceEdit()
					const lineRange =
						i < currentLines.length
							? new vscode.Range(i, 0, i, currentLines[i].length)
							: new vscode.Range(i, 0, i, 0)

					workspaceEdit.replace(document.uri, lineRange, newLines[i])
					await vscode.workspace.applyEdit(workspaceEdit)

					// Update current content
					this.currentDocumentState.currentContent = document.getText()

					// Create a range for the changed line
					const changeRange = new vscode.Range(
						new vscode.Position(i, 0),
						new vscode.Position(i, newLines[i].length)
					)

					// Refresh decorations for this change
					await this.refreshEditor()

					// Ensure we scroll to the changed line
					await this.scrollToRange(editor, changeRange)

					// Small delay to make the changes visible
					await new Promise((resolve) => setTimeout(resolve, 50))
				}
			}

			// Handle case where new content is shorter
			if (newLines.length < currentLines.length) {
				const workspaceEdit = new vscode.WorkspaceEdit()
				const deleteRange = new vscode.Range(
					new vscode.Position(newLines.length, 0),
					new vscode.Position(currentLines.length, 0)
				)
				workspaceEdit.delete(document.uri, deleteRange)
				await vscode.workspace.applyEdit(workspaceEdit)
			}

			return true
		} catch (error) {
			console.error("Failed to apply streaming content:", error)
			return false
		}
	}

	private findChangedRanges(originalLines: string[], newLines: string[]): vscode.Range[] {
		const changes: vscode.Range[] = []
		let changeStart = -1

		for (let i = 0; i < Math.max(originalLines.length, newLines.length); i++) {
			const originalLine = i < originalLines.length ? originalLines[i] : null
			const newLine = i < newLines.length ? newLines[i] : null

			if (originalLine !== newLine) {
				if (changeStart === -1) {
					changeStart = i
				}
			} else if (changeStart !== -1) {
				changes.push(new vscode.Range(changeStart, 0, i - 1, newLines[i - 1]?.length ?? 0))
				changeStart = -1
			}
		}

		if (changeStart !== -1) {
			changes.push(
				new vscode.Range(changeStart, 0, newLines.length - 1, newLines[newLines.length - 1]?.length ?? 0)
			)
		}

		return changes
	}

	public async finalize(): Promise<boolean> {
		if (!this.currentDocumentState) {
			return false
		}

		try {
			const document = await this.getDocument()
			if (!document) {
				return false
			}

			const editor = vscode.window.visibleTextEditors.find(
				(e) => e.document.uri.toString() === document.uri.toString()
			)

			if (!editor) {
				return false
			}

			// Store edited blocks with more context
			const originalLines = this.currentDocumentState.originalContent.split("\n")
			const currentLines = this.currentDocumentState.currentContent.split("\n")
			const editedBlocks: Array<{
				start: number
				end: number
				content: string
				originalContent: string
				context: string
			}> = []

			let blockStart = -1
			let contextLines = 2 // Number of context lines to include

			for (let i = 0; i < Math.max(originalLines.length, currentLines.length); i++) {
				if (i >= originalLines.length || i >= currentLines.length || originalLines[i] !== currentLines[i]) {
					if (blockStart === -1) {
						blockStart = Math.max(0, i - contextLines)
					}
				} else if (blockStart !== -1) {
					const blockEnd = Math.min(i + contextLines, currentLines.length)
					const contextBefore = originalLines
						.slice(Math.max(0, blockStart - contextLines), blockStart)
						.join("\n")
					const contextAfter = originalLines.slice(i, blockEnd).join("\n")

					editedBlocks.push({
						start: blockStart,
						end: i - 1,
						content: currentLines.slice(blockStart, i).join("\n"),
						originalContent: originalLines.slice(blockStart, i).join("\n"),
						context: `${contextBefore}\n${contextAfter}`,
					})
					blockStart = -1
				}
			}

			if (blockStart !== -1) {
				const blockEnd = currentLines.length
				const contextBefore = originalLines.slice(Math.max(0, blockStart - contextLines), blockStart).join("\n")

				editedBlocks.push({
					start: blockStart,
					end: blockEnd - 1,
					content: currentLines.slice(blockStart, blockEnd).join("\n"),
					originalContent: originalLines
						.slice(blockStart, Math.min(blockEnd, originalLines.length))
						.join("\n"),
					context: contextBefore,
				})
			}

			// Clear all decorations
			editor.setDecorations(this.originalContentDecoration, [])
			editor.setDecorations(this.newContentDecoration, [])

			// Create URIs for diff view
			const originalUri = vscode.Uri.parse(this.currentDocumentState.uri)
			const modifiedUri = originalUri.with({ scheme: CONSTANTS.MODIFIED_URI_SCHEME })

			// Create virtual documents for diff view with enhanced metadata
			const originalDoc = new vscode.WorkspaceEdit()
			originalDoc.createFile(originalUri.with({ scheme: CONSTANTS.DIFF_VIEW_URI_SCHEME }), {
				ignoreIfExists: true,
				contents: new TextEncoder().encode(this.currentDocumentState.originalContent),
			})

			// Create a detailed diff summary
			const diffSummary = editedBlocks
				.map((block, index) => {
					return `/* Edit Block ${index + 1} (Lines ${block.start + 1}-${block.end + 1})
Context before:
${block.context}

Original content:
${block.originalContent}

New content:
${block.content}
*/`
				})
				.join("\n\n")

			// Add edited blocks with enhanced metadata
			const modifiedContent =
				this.currentDocumentState.currentContent +
				"\n\n" +
				"/* ===== Edit Summary =====\n" +
				`Total changes: ${editedBlocks.length} blocks\n` +
				"===================== */\n\n" +
				diffSummary

			const modifiedDoc = new vscode.WorkspaceEdit()
			modifiedDoc.createFile(modifiedUri, {
				ignoreIfExists: true,
				contents: new TextEncoder().encode(modifiedContent),
			})

			await vscode.workspace.applyEdit(originalDoc)
			await vscode.workspace.applyEdit(modifiedDoc)

			// Show enhanced diff view
			await vscode.commands.executeCommand(
				"vscode.diff",
				originalUri.with({ scheme: CONSTANTS.DIFF_VIEW_URI_SCHEME }),
				modifiedUri,
				"📝 Code Changes Summary"
			)

			// Update the document with the final content
			const finalEdit = new vscode.WorkspaceEdit()
			finalEdit.replace(
				document.uri,
				new vscode.Range(0, 0, document.lineCount, 0),
				this.currentDocumentState.currentContent
			)
			await vscode.workspace.applyEdit(finalEdit)

			return true
		} catch (error) {
			console.error("Failed to show diff view:", error)
			return false
		}
	}

	// ... rest of the methods remain the same (getDocument, saveChanges, rejectChanges, etc.)

	private async refreshEditor(): Promise<void> {
		await this.documentReadyPromise
		if (!this.currentDocumentState) {
			throw new Error("No active document")
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
			editor.setDecorations(this.originalContentDecoration, [])
			editor.setDecorations(this.newContentDecoration, [])

			if (this.currentDocumentState.isStreaming) {
				const originalLines = this.currentDocumentState.originalContent.split("\n")
				const currentLines = this.currentDocumentState.currentContent.split("\n")

				const originalRanges: vscode.Range[] = []
				const newRanges: vscode.Range[] = []

				// Compare lines and apply decorations
				for (let i = 0; i < Math.max(originalLines.length, currentLines.length); i++) {
					if (i < originalLines.length && i < currentLines.length) {
						if (originalLines[i] !== currentLines[i]) {
							// Line was modified - show both decorations with full line coverage
							const originalRange = new vscode.Range(
								new vscode.Position(i, 0),
								new vscode.Position(i, Math.max(originalLines[i].length, 1))
							)
							const newRange = new vscode.Range(
								new vscode.Position(i, 0),
								new vscode.Position(i, Math.max(currentLines[i].length, 1))
							)
							originalRanges.push(originalRange)
							newRanges.push(newRange)
						}
					} else if (i < originalLines.length) {
						// Line was removed - show original decoration
						const originalRange = new vscode.Range(
							new vscode.Position(i, 0),
							new vscode.Position(i, Math.max(originalLines[i].length, 1))
						)
						originalRanges.push(originalRange)
					} else if (i < currentLines.length) {
						// Line was added - show new decoration
						const newRange = new vscode.Range(
							new vscode.Position(i, 0),
							new vscode.Position(i, Math.max(currentLines[i].length, 1))
						)
						newRanges.push(newRange)
					}
				}

				// Apply decorations with improved visibility
				editor.setDecorations(this.originalContentDecoration, originalRanges)
				editor.setDecorations(this.newContentDecoration, newRanges)
			}
		}
	}

	private async getDocument(): Promise<vscode.TextDocument | undefined> {
		await this.documentReadyPromise
		if (!this.currentDocumentState) {
			throw new Error("No active document")
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

			await document.save()
			const finalContent = document.getText()
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
			throw new Error("No active document")
		}

		try {
			const document = await this.getDocument()
			if (!document) {
				return false
			}

			const workspaceEdit = new vscode.WorkspaceEdit()
			workspaceEdit.replace(
				document.uri,
				new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
				this.currentDocumentState.originalContent
			)

			const success = await vscode.workspace.applyEdit(workspaceEdit)
			if (success) {
				await document.save()
				this.dispose()
			}
			return success
		} catch (error) {
			console.error("Failed to reject changes:", error)
			return false
		}
	}

	public isOpen(): boolean {
		return !!this.currentDocumentState
	}

	public setAutoScroll(enabled: boolean): void {
		if (this.currentDocumentState) {
			this.currentDocumentState.autoScroll = enabled
		}
	}
	public dispose() {
		this.originalContentDecoration.dispose()
		this.newContentDecoration.dispose()
		this.currentDocumentState = undefined

		if (vscode.window.activeTextEditor) {
			this.originalContentDecoration.dispose()
			this.newContentDecoration.dispose()
		}
	}
}
