import * as vscode from "vscode"
import * as DMP from "diff-match-patch"
import delay from "delay"

interface MatchResult {
	success: boolean
	newContent?: string
	lineStart?: number
	lineEnd?: number
	failureReason?: string
}

// Add these to the EditBlock interface
interface EditBlock {
	id: string
	searchContent: string
	currentContent: string
	finalContent?: string
	status: "pending" | "streaming" | "final"
	matchedLocation?: {
		lineStart: number
		lineEnd: number
	}
	dmpAttempted?: boolean
}

interface BlockResult {
	id: string
	searchContent: string
	replaceContent: string
	wasApplied: boolean
	failureReason?: string
}

/**
 * Maintains the state of a document being edited
 * @property uri - VSCode URI of the document
 * @property originalContent - Original content when editing started
 * @property currentContent - Current content with all edits applied
 * @property editBlocks - Map of edit blocks being processed
 */
interface DocumentState {
	uri: vscode.Uri
	originalContent: string
	currentContent: string
	editBlocks: Map<string, EditBlock>
	lastUpdateResults?: BlockResult[] // Add this line
}

interface BlockResult {
	id: string
	searchContent: string
	replaceContent: string
	wasApplied: boolean
	failureReason?: string
}
/**
 * Handles inline editing functionality in VSCode text editors
 * Provides real-time updates, decorations, and manages edit state
 *
 * Key features:
 * - Supports streaming updates with visual indicators
 * - Maintains document state and edit history
 * - Handles queuing and sequential processing of edits
 * - Provides visual decorations for different edit states
 * - Supports auto-scrolling to edited regions
 */
export class InlineEditHandler {
	// Controls auto-scroll behavior
	private isAutoScrollEnabled: boolean = true

	// Maintains current document state
	protected currentDocumentState: DocumentState | undefined

	constructor() {
		this.logger("InlineEditHandler initialized", "debug")
	}

	/**
	 * Scrolls the editor to show the edited range with context
	 * Adds a temporary highlight effect to draw attention
	 *
	 * @param editor - The VSCode text editor to scroll
	 * @param range - The range to scroll to and highlight
	 *
	 * Features:
	 * - Centers the edit in view
	 * - Shows context lines above/below
	 * - Adds temporary highlight animation
	 * - Respects auto-scroll setting
	 */
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
		} catch (error) {
			this.logger(`Failed to scroll to range: ${error}`, "error")
		}
	}

	/**
	 * Opens a file for editing and initializes the document state
	 * Processes any pending operations that arrived before opening
	 *
	 * @param id - Unique identifier for this edit session
	 * @param filePath - Path to the file to edit
	 * @param searchContent - Initial content to search for
	 *
	 * Steps:
	 * 1. Reads file content
	 * 2. Shows document in editor
	 * 3. Initializes document state
	 * 4. Processes pending operations
	 * 5. Applies initial decorations
	 */
	public async open(id: string, filePath: string, searchContent: string): Promise<void> {
		this.logger(`Opening file ${filePath} with id ${id}`, "debug")
		try {
			if (this.currentDocumentState) {
				this.logger(`Document already open, no need to open again`, "debug")
				return
			}
			const uri = vscode.Uri.file(filePath)
			const documentBuffer = await vscode.workspace.fs.readFile(uri)
			const documentContent = Buffer.from(documentBuffer).toString("utf8")

			// now let's make it focused and active
			await vscode.window.showTextDocument(uri, {
				viewColumn: vscode.ViewColumn.Active,
				preserveFocus: false,
				preview: false,
			})

			// Initialize or reset document state
			this.currentDocumentState = {
				uri: uri,
				originalContent: documentContent,
				currentContent: documentContent,
				editBlocks: new Map(),
			}

			// Add initial block
			this.currentDocumentState.editBlocks.set(id, {
				id,
				searchContent,
				currentContent: searchContent,
				status: "pending",
			})

			// Apply decorations
			await this.refreshEditor()
			this.logger(`Successfully opened file ${filePath}`, "debug")
			return
		} catch (error) {
			this.logger(`Failed to open document: ${error}`, "error")
			throw error
		}
	}

	/**
	 * Applies streaming content updates to an edit block
	 * Used for real-time updates while content is being generated
	 *
	 * @param id - Unique identifier for the edit block
	 * @param searchContent - Content to search for in the document
	 * @param content - New content to apply (streaming)
	 *
	 * Features:
	 * - Queues operations if editor isn't ready
	 * - Creates new block if none exists
	 * - Updates block status to "streaming"
	 * - Triggers visual updates
	 */
	public async applyStreamContent(id: string, searchContent: string, content: string): Promise<void> {
		this.logger(`Applying stream content for id ${id}`, "debug")

		// If editor isn't open, queue the operation
		if (!this.isOpen()) {
			this.logger(`Editor not open, queueing stream operation for id ${id}`, "debug")
			await this.open(id, searchContent, content)
		}

		try {
			this.validateDocumentState()
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

			this.logger(`Applying streaming content for id ${id}`, "info")
			this.logger(`searchContent length: ${searchContent.length}`, "info")
			this.logger(`replaceContent length: ${content.length}`, "info")
			// Update entire file content
			await this.updateFileContent()
			return
		} catch (error) {
			this.logger(`Failed to apply streaming content: ${error}`, "error")
			throw error
		}
	}

	/**
	 * Applies final content to an edit block
	 * Used when content generation is complete
	 *
	 * @param id - Unique identifier for the edit block
	 * @param searchContent - Content to search for in the document
	 * @param content - Final content to apply
	 *
	 * Features:
	 * - Queues operations if editor isn't ready
	 * - Creates new block if none exists
	 * - Updates block status to "final"
	 * - Stores final content for future reference
	 */
	public async applyFinalContent(id: string, searchContent: string, content: string): Promise<void> {
		this.logger(`Applying final content for id ${id}`, "debug")

		// If editor isn't open, queue the operation
		if (!this.isOpen()) {
			this.logger(`Editor not open, queueing final operation for id ${id}`, "debug")
			return
		}

		try {
			this.validateDocumentState()
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
			return
		} catch (error) {
			this.logger(`Failed to apply final content: ${error}`, "error")
			throw error
		}
	}

	/**
	 * Refreshes the editor's visual state
	 * Updates decorations and scrolling for all edit blocks
	 *
	 * Process:
	 * 1. Clears existing decorations
	 * 2. Groups ranges by edit status
	 * 3. Applies new decorations for each status
	 * 4. Handles auto-scrolling to active edits
	 *
	 * Decorations:
	 * - Pending: Awaiting changes
	 * - Streaming: Currently receiving updates
	 * - Merge: Ready for review
	 */
	private async refreshEditor(): Promise<void> {
		this.validateDocumentState()

		const document = await this.getDocument()
		if (!document) {
			throw new Error("No active document to refresh editor.")
		}

		const editor = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.toString() === document.uri.toString()
		)

		if (editor) {
			// Clear existing decorations

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
		}
	}

	/**
	 * Forces all edit blocks to their final state
	 * Used when streaming needs to be completed immediately
	 *
	 * @param diffBlocks - Array of blocks with their final content
	 *
	 * Process:
	 * 1. Shows document in active editor
	 * 2. Updates all blocks to final state
	 * 3. Applies changes to document
	 * 4. Updates decorations
	 *
	 * Note: This is typically used when streaming needs to be
	 * terminated early or when applying multiple changes at once
	 */
	public async forceFinalizeAll(
		diffBlocks: { id: string; searchContent: string; replaceContent: string }[]
	): Promise<void> {
		this.logger("Forcing finalization of all blocks", "debug")
		this.validateDocumentState()
		// let's open the document and make it focused and active
		await vscode.window.showTextDocument(this.currentDocumentState.uri, {
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
			await this.updateFileContent()
			// format the document
			// const isDocumentPython = this.currentDocumentState.uri.fsPath.endsWith(".py")
			// if (isDocumentPython) {
			// 	await vscode.commands.executeCommand("editor.action.formatDocument")
			// }
			// await vscode.commands.executeCommand("editor.action.formatDocument")
			return
		} catch (error) {
			this.logger(`Failed to finalize all blocks: ${error}`, "error")
			throw error
		}
	}

	/**
	 * Retrieves or opens the document being edited
	 * Ensures we have a valid document reference
	 *
	 * Process:
	 * 1. Checks for existing document in workspace
	 * 2. Opens document if not found or closed
	 * 3. Returns undefined if document cannot be accessed
	 *
	 * Note: This is a helper method used by other operations
	 * that need to access or modify the document
	 */
	private async getDocument(): Promise<vscode.TextDocument | undefined> {
		this.validateDocumentState()
		try {
			const { uri } = this.currentDocumentState
			let document = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString())
			if (!document || !document.isClosed) {
				document = await vscode.workspace.openTextDocument(uri)
			}
			return document
		} catch (error) {
			this.logger(`Failed to get document: ${error}`, "error")
			return undefined
		}
	}

	private formatToDiff(searchContent: string, replaceContent: string): string {
		return `<<<<<<< SEARCH\n${searchContent}\n=======\n${replaceContent}\n>>>>>>> REPLACE`
	}

	private findAndReplace(content: string, searchContent: string, replaceContent: string): MatchResult {
		const blocks = this.currentDocumentState?.editBlocks.values()
		// Look up if we've already found this block's match
		const matchedBlock = Array.from(blocks ?? []).find((block) => block.searchContent === searchContent)

		// If we already found the match location, just do the replacement
		if (matchedBlock?.matchedLocation) {
			const contentLines = content.split("\n")
			const diffAsReplaceLines = this.formatToDiff(searchContent, replaceContent).split("\n")

			const newContent = [
				...contentLines.slice(0, matchedBlock.matchedLocation.lineStart),
				...diffAsReplaceLines,
				...contentLines.slice(matchedBlock.matchedLocation.lineEnd + 1),
			].join("\n")

			return {
				success: true,
				newContent,
			}
		}

		// 1. Perfect match
		const perfectMatch = this.findPerfectMatch(content, searchContent)
		if (perfectMatch.success && matchedBlock) {
			matchedBlock.matchedLocation = {
				lineStart: perfectMatch.lineStart!,
				lineEnd: perfectMatch.lineEnd!,
			}
			return this.performReplace(content, perfectMatch.lineStart!, perfectMatch.lineEnd!, replaceContent)
		}

		// 2. White space match
		const whitespaceMatch = this.findWhitespaceMatch(content, searchContent)
		if (whitespaceMatch.success && matchedBlock) {
			matchedBlock.matchedLocation = {
				lineStart: whitespaceMatch.lineStart!,
				lineEnd: whitespaceMatch.lineEnd!,
			}
			return this.performReplace(content, whitespaceMatch.lineStart!, whitespaceMatch.lineEnd!, replaceContent)
		}

		// 3. Trailing space match
		const trailingMatch = this.findTrailingMatch(content, searchContent)
		if (trailingMatch.success && matchedBlock) {
			matchedBlock.matchedLocation = {
				lineStart: trailingMatch.lineStart!,
				lineEnd: trailingMatch.lineEnd!,
			}
			return this.performReplace(content, trailingMatch.lineStart!, trailingMatch.lineEnd!, replaceContent)
		}

		// 4. Last resort: DMP match (only if we haven't tried it yet)
		if (matchedBlock && !matchedBlock.dmpAttempted) {
			matchedBlock.dmpAttempted = true // Mark that we've tried DMP
			const dmpMatch = this.findDMPMatch(content, searchContent)
			if (dmpMatch.success) {
				matchedBlock.matchedLocation = {
					lineStart: dmpMatch.lineStart!,
					lineEnd: dmpMatch.lineEnd!,
				}
				return this.performReplace(content, dmpMatch.lineStart!, dmpMatch.lineEnd!, replaceContent)
			}
		}

		return { success: false }
	}

	private performReplace(content: string, startLine: number, endLine: number, replaceContent: string): MatchResult {
		const contentLines = content.split("\n")
		const originalLines = contentLines.slice(startLine, endLine + 1)
		const replaceLines = replaceContent.split("\n")

		// Determine the indentation of the starting line
		const startLineIndent = originalLines[0].match(/^(\s*)/)
		const indent = startLineIndent ? startLineIndent[1] : ""

		const adjustedReplaceLines = replaceLines.map((line, index) => {
			return indent + line.trimStart()
		})

		console.log("adjustedReplaceLines", adjustedReplaceLines)

		const diffAsReplaceLines = this.formatToDiff(content, adjustedReplaceLines.join("\n")).split("\n")

		const newContentLines = [
			...contentLines.slice(0, startLine),
			...diffAsReplaceLines,
			...contentLines.slice(endLine + 1),
		]

		return {
			success: true,
			newContent: newContentLines.join("\n"),
		}
	}

	private findPerfectMatch(content: string, searchContent: string): MatchResult {
		const contentLines = content.split("\n")
		const searchLines = searchContent.split("\n")

		for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
			if (contentLines.slice(i, i + searchLines.length).join("\n") === searchLines.join("\n")) {
				return {
					success: true,
					newContent: content,
					lineStart: i,
					lineEnd: i + searchLines.length - 1,
				}
			}
		}
		return { success: false }
	}

	private findWhitespaceMatch(content: string, searchContent: string): MatchResult {
		const contentLines = content.split("\n")
		const searchLines = searchContent.split("\n")

		for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
			const matches = searchLines.every((searchLine, j) => {
				const contentLine = contentLines[i + j]
				return contentLine.replace(/\s+/g, " ") === searchLine.replace(/\s+/g, " ")
			})

			if (matches) {
				return {
					success: true,
					newContent: content,
					lineStart: i,
					lineEnd: i + searchLines.length - 1,
				}
			}
		}
		return { success: false }
	}

	private findTrailingMatch(content: string, searchContent: string): MatchResult {
		const contentLines = content.split("\n")
		const searchLines = searchContent.split("\n")

		for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
			const matches = searchLines.every((searchLine, j) => {
				const contentLine = contentLines[i + j]
				return contentLine.trimEnd() === searchLine.trimEnd()
			})

			if (matches) {
				return {
					success: true,
					newContent: content,
					lineStart: i,
					lineEnd: i + searchLines.length - 1,
				}
			}
		}
		return { success: false }
	}

	private findDMPMatch(content: string, searchContent: string): MatchResult {
		const dmp = new DMP.diff_match_patch()
		const diffs = dmp.diff_main(content, searchContent)
		dmp.diff_cleanupSemantic(diffs)

		// Look for the longest equal section that matches our search content
		let bestMatch = { start: -1, end: -1, length: 0 }
		let currentPos = 0

		for (const [type, text] of diffs) {
			if (type === 0 && text.length > bestMatch.length) {
				// DIFF_EQUAL
				bestMatch = {
					start: currentPos,
					end: currentPos + text.length,
					length: text.length,
				}
			}
			currentPos += text.length
		}

		if (bestMatch.length > searchContent.length * 0.9) {
			// 90% match threshold
			const startLine = content.substr(0, bestMatch.start).split("\n").length - 1
			const endLine = startLine + searchContent.split("\n").length - 1

			return {
				success: true,
				newContent: content,
				lineStart: startLine,
				lineEnd: endLine,
			}
		}

		return { success: false }
	}

	private async updateFileContent(): Promise<void> {
		this.validateDocumentState()

		try {
			const document = await this.getDocument()
			if (!document) {
				throw new Error("No active document to update content.")
			}

			// Start with original content
			let newContent = this.currentDocumentState.originalContent
			const results: BlockResult[] = []

			// Apply all blocks in order
			const sortedBlocks = Array.from(this.currentDocumentState.editBlocks.values()).sort((a, b) => {
				const indexA = newContent.indexOf(a.searchContent)
				const indexB = newContent.indexOf(b.searchContent)
				return indexA - indexB
			})

			for (const block of sortedBlocks) {
				// const formattedGitDiff = `<<<<<<< SEARCH\n${block.searchContent}\n=======\n${block.currentContent}\n>>>>>>> REPLACE`
				const matchResult = this.findAndReplace(newContent, block.searchContent, block.currentContent)

				if (matchResult.success && matchResult.newContent) {
					newContent = matchResult.newContent
					results.push({
						id: block.id,
						searchContent: block.searchContent,
						replaceContent: block.currentContent,
						wasApplied: true,
					})
				} else {
					results.push({
						id: block.id,
						searchContent: block.searchContent,
						replaceContent: block.currentContent,
						wasApplied: false,
						failureReason: matchResult.failureReason,
					})

					this.logger(`Failed to apply block ${block.id}: ${matchResult.failureReason}`, "warn")
				}
			}

			// Store results for save changes
			this.currentDocumentState.lastUpdateResults = results

			const entireRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))

			const workspaceEdit = new vscode.WorkspaceEdit()
			workspaceEdit.replace(document.uri, entireRange, newContent)
			const success = await vscode.workspace.applyEdit(workspaceEdit)

			if (success) {
				this.logger("File content updated", "info")
				this.currentDocumentState.currentContent = newContent
				await this.refreshEditor()
			}
			return
		} catch (error) {
			this.logger(`Failed to update file content: ${error}`, "error")
			throw error
		}
	}

	/**
	 * Enhanced saveChanges with block status reporting
	 */
	public async saveChanges(): Promise<{ finalContent: string; results: BlockResult[] }> {
		this.logger("Saving changes", "debug")
		this.validateDocumentState()

		try {
			const document = await this.getDocument()
			if (!document || document.isClosed) {
				throw new Error("No active document to save changes.")
			}

			// Get the current content with merge markers
			let content = document.getText()

			// Clean up merge markers and keep only the replacement content
			while (content.includes("<<<<<<< SEARCH")) {
				const startMarker = "<<<<<<< SEARCH"
				const middleMarker = "======="
				const endMarker = ">>>>>>> REPLACE"

				const startIndex = content.indexOf(startMarker)
				const middleIndex = content.indexOf(middleMarker, startIndex)
				const endIndex = content.indexOf(endMarker, middleIndex)

				if (startIndex === -1 || middleIndex === -1 || endIndex === -1) {
					break
				}

				// Extract just the replacement content (between ======= and >>>>>>>)
				let replaceContent = content.substring(middleIndex + middleMarker.length, endIndex)
				// we need to remove the \n at the start of the replaceContent
				const startAndEndPattern = ["\r\n", "\n", "\r"]
				const startPattern = startAndEndPattern.find((pattern) => replaceContent.startsWith(pattern))
				const endPattern = startAndEndPattern.find((pattern) => replaceContent.endsWith(pattern))
				if (startPattern) {
					replaceContent = replaceContent.substring(startPattern.length)
				}
				if (endPattern) {
					replaceContent = replaceContent.substring(0, replaceContent.length - endPattern.length)
				}

				// Replace the entire merge block with just the replacement content
				content =
					content.substring(0, startIndex) + replaceContent + content.substring(endIndex + endMarker.length)
			}

			// Apply the cleaned content back to the document
			const entireRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))

			const workspaceEdit = new vscode.WorkspaceEdit()
			workspaceEdit.replace(document.uri, entireRange, content)
			await vscode.workspace.applyEdit(workspaceEdit)

			// Save the document
			await document.save()
			await delay(300)

			const results = this.currentDocumentState.lastUpdateResults || []

			// Clean up
			setTimeout(() => {
				this.dispose()
			}, 1)

			return { finalContent: content, results }
		} catch (error) {
			this.logger(`Failed to save changes: ${error}`, "error")
			throw error
		}
	}
	/**
	 * Rejects all changes and restores original content
	 * Used when edits need to be discarded
	 *
	 * Process:
	 * 1. Validates document state
	 * 2. Restores original content from when file was opened
	 * 3. Saves the restored content
	 * 4. Cleans up resources
	 *
	 * Note: This completely discards all changes and cannot be undone
	 */
	public async rejectChanges(): Promise<void> {
		this.logger("Rejecting changes", "debug")
		this.validateDocumentState()

		try {
			const document = await this.getDocument()
			if (!document) {
				throw new Error("No active document to reject changes.")
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
			} else {
				this.logger("Failed to reject changes: workspaceEdit.applyEdit returned false", "error")
				throw new Error("Failed to reject changes: workspaceEdit.applyEdit returned false")
			}
		} catch (error) {
			this.logger(`Failed to reject changes: ${error}`, "error")
			throw error
		}
	}

	public isOpen(): boolean {
		const isOpen = !!this.currentDocumentState
		return isOpen
	}

	public setAutoScroll(enabled: boolean) {
		this.isAutoScrollEnabled = enabled
		this.logger(`Auto-scroll ${enabled ? "enabled" : "disabled"}`)
	}

	public dispose() {
		this.logger("Disposing InlineEditHandler")
	}

	// type guard against this.currentDocumentState being undefined
	/**
	 * Type guard to ensure document state exists
	 * Throws error if state is undefined
	 *
	 * This is used by methods that require access to document state
	 * to ensure type safety and prevent undefined errors
	 */
	private validateDocumentState(): asserts this is { currentDocumentState: DocumentState } {
		if (!this.currentDocumentState) {
			this.logger("No active document state", "error")
			throw new Error("No active document state.")
		}
	}

	/**
	 * Logs messages with contextual information
	 * Includes operation queue size, pending operations count,
	 * and editor state for better debugging
	 *
	 * @param message - The message to log
	 * @param level - Log level (info/debug/warn/error)
	 */
	private logger(message: string, level: "info" | "debug" | "warn" | "error" = "debug") {
		const timestamp = new Date().toISOString()
		const isEditorOpen = this.isOpen()

		console[level](
			`[InlineEditHandler] ${timestamp} | ` + `Editor: ${isEditorOpen ? "open" : "closed"} | ` + message
		)
	}
}
