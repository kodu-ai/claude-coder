import * as vscode from "vscode"

export class InlineEditHandler {
	private pendingDecoration: vscode.TextEditorDecorationType
	private streamingDecoration: vscode.TextEditorDecorationType
	private mergeDecoration: vscode.TextEditorDecorationType
	private currentRange: vscode.Range | undefined
	private originalContent: string | undefined
	private editor: vscode.TextEditor | undefined
	private isAutoScrollEnabled: boolean = true

	constructor(private context: vscode.ExtensionContext) {
		this.initializeDecorations()
	}

	private initializeDecorations() {
		this.pendingDecoration = vscode.window.createTextEditorDecorationType({
			backgroundColor: new vscode.ThemeColor("diffEditor.insertedLineBackground"),
			isWholeLine: true,
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
		})

		this.streamingDecoration = vscode.window.createTextEditorDecorationType({
			backgroundColor: new vscode.ThemeColor("diffEditor.removedLineBackground"),
			isWholeLine: true,
			fontStyle: "italic",
		})

		this.mergeDecoration = vscode.window.createTextEditorDecorationType({
			after: {
				contentText: " Review change",
				color: new vscode.ThemeColor("editorGhostText.foreground"),
			},
		})
	}

	private async scrollToRange(range: vscode.Range) {
		if (!this.editor || !this.isAutoScrollEnabled) {
			return
		}

		const midLine = Math.floor((range.start.line + range.end.line) / 2)
		const visibleRanges = this.editor.visibleRanges

		if (visibleRanges.length === 0) {
			return
		}

		const isVisible = visibleRanges.some(
			(visibleRange) => visibleRange.contains(range.start) && visibleRange.contains(range.end)
		)

		if (!isVisible) {
			const targetRange = new vscode.Range(midLine, 0, midLine, 0)

			await this.editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter)

			const highlightDecoration = vscode.window.createTextEditorDecorationType({
				backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
				isWholeLine: true,
			})

			this.editor.setDecorations(highlightDecoration, [range])
			setTimeout(() => {
				highlightDecoration.dispose()
			}, 500)
		}
	}

	public setAutoScroll(enabled: boolean) {
		this.isAutoScrollEnabled = enabled
	}

	public async open(filePath: string, searchContent: string): Promise<boolean> {
		const document = await vscode.workspace.openTextDocument(filePath)
		this.editor = await vscode.window.showTextDocument(document)

		const text = document.getText()
		const startIndex = text.indexOf(searchContent)

		if (startIndex === -1) {
			return false
		}

		const startPos = document.positionAt(startIndex)
		const endPos = document.positionAt(startIndex + searchContent.length)
		this.currentRange = new vscode.Range(startPos, endPos)
		this.originalContent = searchContent

		this.editor.setDecorations(this.pendingDecoration, [this.currentRange])

		if (this.currentRange) {
			await this.scrollToRange(this.currentRange)
		}

		return true
	}

	public async applyStreamContent(content: string): Promise<boolean> {
		if (!this.editor || !this.currentRange) {
			return false
		}

		const mergeContent = [
			"<<<<<<< Original",
			this.originalContent,
			"=======",
			content,
			">>>>>>> Incoming (Streaming)",
		].join("\n")

		try {
			await this.editor.edit((editBuilder) => {
				if (this.currentRange) {
					editBuilder.replace(this.currentRange, mergeContent)
				}
			})

			const newEndPos = this.editor.document.positionAt(
				this.editor.document.offsetAt(this.currentRange.start) + mergeContent.length
			)
			this.currentRange = new vscode.Range(this.currentRange.start, newEndPos)
			this.editor.setDecorations(this.streamingDecoration, [this.currentRange])

			await this.scrollToRange(this.currentRange)

			return true
		} catch (error) {
			console.error("Failed to apply streaming content:", error)
			return false
		}
	}

	public async applyFinalContent(content: string): Promise<boolean> {
		if (!this.editor || !this.currentRange) {
			return false
		}

		const mergeContent = [
			"<<<<<<< Original",
			this.originalContent,
			"=======",
			content,
			">>>>>>> Incoming (Final)",
		].join("\n")

		try {
			await this.editor.edit((editBuilder) => {
				if (this.currentRange) {
					editBuilder.replace(this.currentRange, mergeContent)
				}
			})

			this.editor.setDecorations(this.streamingDecoration, [])
			this.editor.setDecorations(this.mergeDecoration, [this.currentRange])

			await this.scrollToRange(this.currentRange)

			return true
		} catch (error) {
			console.error("Failed to apply final content:", error)
			return false
		}
	}

	public async saveChanges(finalContent: string): Promise<boolean> {
		if (!this.editor || !this.currentRange) {
			return false
		}

		try {
			await this.editor.edit((editBuilder) => {
				if (this.currentRange) {
					editBuilder.replace(this.currentRange, finalContent)
				}
			})

			this.clearDecorations()
			this.reset()

			return true
		} catch (error) {
			console.error("Failed to save changes:", error)
			return false
		}
	}

	public async rejectChanges(): Promise<boolean> {
		if (!this.editor || !this.currentRange || !this.originalContent) {
			return false
		}

		try {
			await this.editor.edit((editBuilder) => {
				if (this.currentRange) {
					editBuilder.replace(this.currentRange, this.originalContent!)
				}
			})

			this.clearDecorations()
			this.reset()

			return true
		} catch (error) {
			console.error("Failed to reject changes:", error)
			return false
		}
	}

	private clearDecorations() {
		if (this.editor) {
			this.editor.setDecorations(this.pendingDecoration, [])
			this.editor.setDecorations(this.streamingDecoration, [])
			this.editor.setDecorations(this.mergeDecoration, [])
		}
	}

	private reset() {
		this.currentRange = undefined
		this.originalContent = undefined
	}

	public dispose() {
		this.clearDecorations()
		this.pendingDecoration.dispose()
		this.streamingDecoration.dispose()
		this.mergeDecoration.dispose()
	}

	public getVisibleRange(): vscode.Range | undefined {
		if (!this.editor) {
			return undefined
		}
		return this.editor.visibleRanges[0]
	}

	public isRangeVisible(range: vscode.Range): boolean {
		const visibleRange = this.getVisibleRange()
		if (!visibleRange) {
			return false
		}
		return visibleRange.contains(range)
	}
}
