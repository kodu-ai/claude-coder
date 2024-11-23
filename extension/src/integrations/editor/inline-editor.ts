import * as vscode from "vscode"

interface MergeFormatOptions {
	startMarker?: string
	midMarker?: string
	endMarker?: string
	showLineNumbers?: boolean
	indent?: string
}

interface DecorationStyleOptions {
	pendingBackground?: string
	streamingBackground?: string
	borderColor?: string
	borderStyle?: string
	borderWidth?: string
	fontStyle?: string
}

interface EditBlock {
	id: string
	range: vscode.Range
	originalContent: string
	currentContent: string
	finalContent?: string
	status: "pending" | "streaming" | "final"
}

export class InlineEditHandler {
	private pendingDecoration: vscode.TextEditorDecorationType
	private streamingDecoration: vscode.TextEditorDecorationType
	private mergeDecoration: vscode.TextEditorDecorationType
	private editor: vscode.TextEditor | undefined
	private isAutoScrollEnabled: boolean = true
	private editBlocks: Map<string, EditBlock> = new Map()

	private defaultMergeFormat: MergeFormatOptions = {
		startMarker: "▼ Original",
		midMarker: "▲ Changes ▼",
		endMarker: "▲ New",
		showLineNumbers: true,
		indent: "  ",
	}

	// Update default styles
	private defaultStyles: DecorationStyleOptions = {
		pendingBackground: "editorError.background", // Lighter red
		streamingBackground: "editor.background", // Regular editor background
		borderColor: "transparent", // Remove borders
		borderStyle: "solid",
		borderWidth: "1px",
		fontStyle: "normal",
	}

	constructor(private mergeFormat: MergeFormatOptions = {}, private styles: DecorationStyleOptions = {}) {
		this.mergeFormat = { ...this.defaultMergeFormat, ...mergeFormat }
		this.styles = { ...this.defaultStyles, ...styles }
		this.initializeDecorations()
	}

	private initializeDecorations() {
		// Base decoration without background color (since colors are in the content)
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
				contentText: "↻ Streaming...",
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

	private formatMergeContent(original: string, updated: string, status: "Streaming" | "Final"): string {
		const { startMarker, midMarker, endMarker, showLineNumbers, indent } = this.mergeFormat
		const lines: string[] = []

		const addLineNumbers = (text: string, startFromOne: boolean = false): string[] => {
			return text.split("\n").map((line, idx) => {
				// Always start line numbers from 1 for each section
				const lineNum = (startFromOne ? idx + 1 : idx + 1).toString().padStart(4, " ")
				return showLineNumbers ? `${lineNum}│ ${indent}${line}` : `${indent}${line}`
			})
		}

		// Add header with visual separator
		lines.push(`╭─── ${startMarker} ${"─".repeat(30)}`)
		lines.push(...addLineNumbers(original, true)) // Start from 1

		// Add middle marker with status
		lines.push(`├─── ${midMarker} (${status}) ${"─".repeat(20)}`)
		lines.push(...addLineNumbers(updated, true)) // Start from 1 again

		// Add footer
		lines.push(`╰─── ${endMarker} ${"─".repeat(30)}`)

		return lines.join("\n")
	}

	public async open(id: string, filePath: string, searchContent: string): Promise<boolean> {
		const document = await vscode.workspace.openTextDocument(filePath)
		this.editor = await vscode.window.showTextDocument(document)

		const text = document.getText()
		const startIndex = text.indexOf(searchContent)

		if (startIndex === -1) {
			return false
		}

		const startPos = document.positionAt(startIndex)
		const endPos = document.positionAt(startIndex + searchContent.length)
		const range = new vscode.Range(startPos, endPos)

		const editBlock: EditBlock = {
			id,
			range,
			originalContent: searchContent,
			currentContent: searchContent,
			status: "pending",
		}

		this.editBlocks.set(id, editBlock)
		this.editor.setDecorations(this.pendingDecoration, [range])

		await this.scrollToRange(range)
		return true
	}

	public async applyStreamContent(id: string, content: string): Promise<boolean> {
		const editBlock = this.editBlocks.get(id)
		if (!this.editor || !editBlock) {
			return false
		}

		try {
			const mergeContent = this.formatMergeContent(editBlock.originalContent, content, "Streaming")

			await this.editor.edit((editBuilder) => {
				editBuilder.replace(editBlock.range, mergeContent)
			})

			const newEndPos = this.editor.document.positionAt(
				this.editor.document.offsetAt(editBlock.range.start) + mergeContent.length
			)
			const newRange = new vscode.Range(editBlock.range.start, newEndPos)

			this.editBlocks.set(id, {
				...editBlock,
				range: newRange,
				currentContent: content,
				status: "streaming",
			})

			this.editor.setDecorations(this.streamingDecoration, [newRange])
			await this.scrollToRange(newRange)

			return true
		} catch (error) {
			console.error("Failed to apply streaming content:", error)
			return false
		}
	}

	public async applyFinalContent(id: string, content: string): Promise<boolean> {
		const editBlock = this.editBlocks.get(id)
		if (!this.editor || !editBlock) {
			return false
		}

		try {
			const mergeContent = this.formatMergeContent(editBlock.originalContent, content, "Final")

			await this.editor.edit((editBuilder) => {
				editBuilder.replace(editBlock.range, mergeContent)
			})

			const newEndPos = this.editor.document.positionAt(
				this.editor.document.offsetAt(editBlock.range.start) + mergeContent.length
			)
			const newRange = new vscode.Range(editBlock.range.start, newEndPos)

			this.editBlocks.set(id, {
				...editBlock,
				range: newRange,
				currentContent: content,
				finalContent: content,
				status: "final",
			})

			this.editor.setDecorations(this.streamingDecoration, [])
			this.editor.setDecorations(this.mergeDecoration, [newRange])

			await this.scrollToRange(newRange)
			return true
		} catch (error) {
			console.error("Failed to apply final content:", error)
			return false
		}
	}

	public async saveChanges(id: string): Promise<boolean> {
		const editBlock = this.editBlocks.get(id)
		if (!this.editor || !editBlock || !editBlock.finalContent) {
			return false
		}

		try {
			await this.editor.edit((editBuilder) => {
				editBuilder.replace(editBlock.range, editBlock.finalContent!)
			})

			this.editBlocks.delete(id)
			this.clearDecorations(editBlock.range)
			return true
		} catch (error) {
			console.error("Failed to save changes:", error)
			return false
		}
	}

	public async rejectChanges(id: string): Promise<boolean> {
		const editBlock = this.editBlocks.get(id)
		if (!this.editor || !editBlock) {
			return false
		}

		try {
			await this.editor.edit((editBuilder) => {
				editBuilder.replace(editBlock.range, editBlock.originalContent)
			})

			this.editBlocks.delete(id)
			this.clearDecorations(editBlock.range)
			return true
		} catch (error) {
			console.error("Failed to reject changes:", error)
			return false
		}
	}

	private async scrollToRange(range: vscode.Range) {
		if (!this.editor || !this.isAutoScrollEnabled) {
			return
		}

		const visibleRanges = this.editor.visibleRanges
		if (visibleRanges.length === 0) {
			return
		}

		// Get the number of visible lines in the editor
		const visibleLines = visibleRanges[0].end.line - visibleRanges[0].start.line

		// Calculate the ideal scroll position to show the end of the content
		const targetLine = Math.max(
			range.end.line - Math.floor(visibleLines * 0.7), // Show the end with some context above
			0
		)

		// Create a range for the target scroll position
		const targetRange = new vscode.Range(targetLine, 0, range.end.line, range.end.character)

		await this.editor.revealRange(targetRange, vscode.TextEditorRevealType.Default)

		const highlightDecoration = vscode.window.createTextEditorDecorationType({
			backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
			isWholeLine: true,
		})

		this.editor.setDecorations(highlightDecoration, [range])
		setTimeout(() => {
			highlightDecoration.dispose()
		}, 500)
	}

	public setAutoScroll(enabled: boolean) {
		this.isAutoScrollEnabled = enabled
	}

	private clearDecorations(range: vscode.Range) {
		if (this.editor) {
			this.editor.setDecorations(this.pendingDecoration, [])
			this.editor.setDecorations(this.streamingDecoration, [])
			this.editor.setDecorations(this.mergeDecoration, [])
		}
	}

	public dispose() {
		this.editBlocks.clear()
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
