import * as diff from "diff"
import fs from "fs/promises"
import * as path from "path"
import { serializeError } from "serialize-error"
import * as vscode from "vscode"
import { ClaudeAsk, ClaudeSay, ClaudeSayTool } from "../../../shared/ExtensionMessage"
import { ToolResponse } from "../types"
import { cwd, formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../utils"
import os from "os"
import { ClaudeAskResponse } from "../../../shared/WebviewMessage"
import { AgentToolOptions, AgentToolParams } from "./types"
import { BaseAgentTool } from "./base-agent.tool"

export class WriteFileTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	// async execute(): Promise<ToolResponse> {
	// 	const { input, ask, say } = this.params
	// 	const { path: relPath, content } = input
	// 	let newContent = content

	// 	if (relPath === undefined) {
	// 		await say(
	// 			"error",
	// 			"Claude tried to use write_to_file without value for required parameter 'path'. Retrying..."
	// 		)

	// 		return `Error: Missing value for required parameter 'path'. Please retry with complete response.
	// 		A good example of a writeToFile tool call is:
	// 		{
	// 			"tool": "write_to_file",
	// 			"path": "path/to/file.txt",
	// 			"content": "new content"
	// 		}
	// 		Please try again with the correct path and content, you are not allowed to write files without a path.
	// 		`
	// 	}

	// 	if (newContent === undefined) {
	// 		await say(
	// 			"error",
	// 			`Claude tried to use write_to_file for '${relPath}' without value for required parameter 'content'. This is likely due to output token limits. Retrying...`
	// 		)

	// 		return `Error: Missing value for required parameter 'content'. Please retry with complete response.
	// 					A good example of a writeToFile tool call is:
	// 		{
	// 			"tool": "write_to_file",
	// 			"path": "path/to/file.txt",
	// 			"content": "new content"
	// 		}
	// 		Please try again with the correct path and content, you are not allowed to write files without a path.
	// 		`
	// 	}

	// 	try {
	// 		const absolutePath = path.resolve(this.cwd, relPath)
	// 		const fileExists = await fs
	// 			.access(absolutePath)
	// 			.then(() => true)
	// 			.catch(() => false)

	// 		let originalContent: string = fileExists ? await fs.readFile(absolutePath, "utf-8") : ""

	// 		if (fileExists) {
	// 			const eol = originalContent.includes("\r\n") ? "\r\n" : "\n"
	// 			if (originalContent.endsWith(eol) && !newContent.endsWith(eol)) {
	// 				newContent += eol
	// 			}
	// 		}

	// 		if (this.alwaysAllowWriteOnly) {
	// 			return await this.writeFileDirectly(absolutePath, newContent, fileExists, relPath, say)
	// 		} else {
	// 			return await this.writeFileWithUserApproval(
	// 				absolutePath,
	// 				originalContent,
	// 				newContent,
	// 				fileExists,
	// 				relPath,
	// 				ask,
	// 				say
	// 			)
	// 		}
	// 	} catch (error) {
	// 		const errorString = `Error writing file: ${JSON.stringify(serializeError(error))}
	// 					A good example of a writeToFile tool call is:
	// 		{
	// 			"tool": "write_to_file",
	// 			"path": "path/to/file.txt",
	// 			"content": "new content"
	// 		}
	// 		Please try again with the correct path and content, you are not allowed to write files without a path.
	// 		`

	// 		await say(
	// 			"error",
	// 			`Error writing file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
	// 		)
	// 		return errorString
	// 	}
	// }

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { path: relPath, content } = input
		let newContent = content
		if (relPath === undefined) {
			return `Error: Missing value for required parameter 'path'. Please retry with complete response.`
		}
		if (newContent === undefined || newContent === "") {
			// Custom error message for this particular case
			await say(
				"error",
				`Claude tried to use write_to_file for '${relPath}' without value for required parameter 'content'. This is likely due to reaching the maximum output token limit. Retrying with suggestion to change response size...`
			)
			return this.formatToolError(
				`Missing value for required parameter 'content'. This may occur if the file is too large, exceeding output limits. Consider splitting into smaller files or reducing content size. Please retry with all required parameters.`
			)
		}
		try {
			const absolutePath = path.resolve(cwd, relPath)
			const fileExists = await fs
				.access(absolutePath)
				.then(() => true)
				.catch(() => false)

			// if the file is already open, ensure it's not dirty before getting its contents
			if (fileExists) {
				const existingDocument = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === absolutePath)
				if (existingDocument && existingDocument.isDirty) {
					await existingDocument.save()
				}
			}

			let originalContent: string
			if (fileExists) {
				originalContent = await fs.readFile(absolutePath, "utf-8")
				// fix issue where claude always removes newline from the file
				const eol = originalContent.includes("\r\n") ? "\r\n" : "\n"
				if (originalContent.endsWith(eol) && !newContent.endsWith(eol)) {
					newContent += eol
				}
			} else {
				originalContent = ""
			}

			const fileName = path.basename(absolutePath)

			// for new files, create any necessary directories and keep track of new directories to delete if the user denies the operation

			// Keep track of newly created directories
			const createdDirs: string[] = await this.createDirectoriesForFile(absolutePath)
			console.log(`Created directories: ${createdDirs.join(", ")}`)
			// make sure the file exists before we open it
			if (!fileExists) {
				await fs.writeFile(absolutePath, "")
			}

			// Open the existing file with the new contents
			const updatedDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath))

			// Show diff
			await vscode.commands.executeCommand(
				"vscode.diff",
				vscode.Uri.parse(`claude-dev-diff:${fileName}`).with({
					query: Buffer.from(originalContent).toString("base64"),
				}),
				updatedDocument.uri,
				`${fileName}: ${fileExists ? "Original ↔ Claude's Changes" : "New File"} (Editable)`
			)

			// if the file was already open, close it (must happen after showing the diff view since if it's the only tab the column will close)
			let documentWasOpen = false

			// close the tab if it's open
			const tabs = vscode.window.tabGroups.all
				.map((tg) => tg.tabs)
				.flat()
				.filter((tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.fsPath === absolutePath)
			for (const tab of tabs) {
				await vscode.window.tabGroups.close(tab)
				console.log(`Closed tab for ${absolutePath}`)
				documentWasOpen = true
			}

			console.log(`Document was open: ${documentWasOpen}`)

			// edit needs to happen after we close the original tab
			const edit = new vscode.WorkspaceEdit()
			if (!fileExists) {
				edit.insert(updatedDocument.uri, new vscode.Position(0, 0), newContent)
			} else {
				const fullRange = new vscode.Range(
					updatedDocument.positionAt(0),
					updatedDocument.positionAt(updatedDocument.getText().length)
				)
				edit.replace(updatedDocument.uri, fullRange, newContent)
			}
			// Apply the edit, but without saving so this doesnt trigger a local save in timeline history
			await vscode.workspace.applyEdit(edit) // has the added benefit of maintaing the file's original EOLs

			// Find the first range where the content differs and scroll to it
			if (fileExists) {
				const diffResult = diff.diffLines(originalContent, newContent)
				for (let i = 0, lineCount = 0; i < diffResult.length; i++) {
					const part = diffResult[i]
					if (part.added || part.removed) {
						const startLine = lineCount + 1
						const endLine = lineCount + (part.count || 0)
						const activeEditor = vscode.window.activeTextEditor
						if (activeEditor) {
							try {
								activeEditor.revealRange(
									// + 3 to move the editor up slightly as this looks better
									new vscode.Range(
										new vscode.Position(startLine, 0),
										new vscode.Position(
											Math.min(endLine + 3, activeEditor.document.lineCount - 1),
											0
										)
									),
									vscode.TextEditorRevealType.InCenter
								)
							} catch (error) {
								console.error(`Error revealing range for ${absolutePath}: ${error}`)
							}
						}
						break
					}
					lineCount += part.count || 0
				}
			}

			// remove cursor from the document
			await vscode.commands.executeCommand("workbench.action.focusSideBar")

			let userResponse: {
				response: ClaudeAskResponse
				text?: string
				images?: string[]
			}
			if (fileExists) {
				userResponse = await ask(
					"tool",
					JSON.stringify({
						tool: "editedExistingFile",
						path: getReadablePath(relPath),
						diff: this.createPrettyPatch(relPath, originalContent, newContent),
					} as ClaudeSayTool)
				)
			} else {
				userResponse = await ask(
					"tool",
					JSON.stringify({
						tool: "newFileCreated",
						path: getReadablePath(relPath),
						content: newContent,
					} as ClaudeSayTool)
				)
			}
			const { response, text, images } = userResponse

			if (response !== "yesButtonTapped") {
				if (!fileExists) {
					if (updatedDocument.isDirty) {
						await updatedDocument.save()
					}
					await this.closeDiffViews()
					await fs.unlink(absolutePath)
					// Remove only the directories we created, in reverse order
					for (let i = createdDirs.length - 1; i >= 0; i--) {
						await fs.rmdir(createdDirs[i])
						console.log(`Directory ${createdDirs[i]} has been deleted.`)
					}
					console.log(`File ${absolutePath} has been deleted.`)
				} else {
					// revert document
					const edit = new vscode.WorkspaceEdit()
					const fullRange = new vscode.Range(
						updatedDocument.positionAt(0),
						updatedDocument.positionAt(updatedDocument.getText().length)
					)
					edit.replace(updatedDocument.uri, fullRange, originalContent)
					// Apply the edit and save, since contents shouldnt have changed this wont show in local history unless of course the user made changes and saved during the edit
					await vscode.workspace.applyEdit(edit)
					await updatedDocument.save()
					console.log(`File ${absolutePath} has been reverted to its original content.`)
					if (documentWasOpen) {
						await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
					}
					await this.closeDiffViews()
				}

				if (response === "messageResponse") {
					await say("user_feedback", text, images)
					// return [true, this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images)]
					return this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images)
				}
				// return [true, await this.formatToolDenied()]
				return await this.formatToolDenied()
			}

			// Save the changes
			const editedContent = updatedDocument.getText()
			if (updatedDocument.isDirty) {
				await updatedDocument.save()
			}
			this.koduDev.didEditFile = true

			await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })

			await this.closeDiffViews()

			// await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })

			// If the edited content has different EOL characters, we don't want to show a diff with all the EOL differences.
			const newContentEOL = newContent.includes("\r\n") ? "\r\n" : "\n"
			const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, newContentEOL)
			const normalizedNewContent = newContent.replace(/\r\n|\n/g, newContentEOL) // just in case the new content has a mix of varying EOL characters
			if (normalizedEditedContent !== normalizedNewContent) {
				const userDiff = diff.createPatch(relPath, normalizedNewContent, normalizedEditedContent)
				await say(
					"user_feedback_diff",
					JSON.stringify({
						tool: fileExists ? "editedExistingFile" : "newFileCreated",
						path: getReadablePath(relPath),
						diff: this.createPrettyPatch(relPath, normalizedNewContent, normalizedEditedContent),
					} as ClaudeSayTool)
				)
				// return [
				// 	false,
				// 	await this.formatToolResult(
				// 		`The user made the following updates to your content:\n\n${userDiff}\n\nThe updated content, which includes both your original modifications and the user's additional edits, has been successfully saved to ${relPath}. Note this does not mean you need to re-write the file with the user's changes, they have already been applied to the file.`
				// 	),
				// ]
				return await this.formatToolResult(
					`The user made the following updates to your content:\n\n${userDiff}\n\nThe updated content, which includes both your original modifications and the user's additional edits, has been successfully saved to ${relPath}. Note this does not mean you need to re-write the file with the user's changes, they have already been applied to the file.`
				)
			} else {
				// return [false, await this.formatToolResult(`The content was successfully saved to ${relPath}.`)]
				return await this.formatToolResult(`The content was successfully saved to ${relPath}.`)
			}
		} catch (error) {
			const errorString = `Error writing file: ${JSON.stringify(serializeError(error))}`
			await say(
				"error",
				`Error writing file:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`
			)
			// return [false, await this.formatToolError(errorString)]
			return await this.formatToolError(errorString)
		}
	}

	private async writeFileDirectly(
		absolutePath: string,
		newContent: string,
		fileExists: boolean,
		relPath: string,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (!fileExists) {
			await fs.mkdir(path.dirname(absolutePath), { recursive: true })
		}
		await fs.writeFile(absolutePath, newContent)
		await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })

		if (fileExists) {
			const { text, images } = {
				text: `Changes applied to ${relPath}:\n\n${this.createPrettyPatch(relPath, "", newContent)}`,
				images: [],
			}
			await say("user_feedback", text)

			return formatToolResponse(formatGenericToolFeedback(text), images)
		} else {
			const { text, images } = { text: `New file written to ${relPath}`, images: [] }
			await say("user_feedback", text)

			return formatToolResponse(formatGenericToolFeedback(text), images)
		}
	}

	private async writeFileWithUserApproval(
		absolutePath: string,
		originalContent: string,
		newContent: string,
		fileExists: boolean,
		relPath: string,
		ask: (
			type: ClaudeAsk,
			question?: string
		) => Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "claude-dev-"))
		const tempFilePath = path.join(tempDir, path.basename(absolutePath))
		await fs.writeFile(tempFilePath, newContent)

		vscode.commands.executeCommand(
			"vscode.diff",
			vscode.Uri.parse(`claude-dev-diff:${path.basename(absolutePath)}`).with({
				query: Buffer.from(originalContent).toString("base64"),
			}),
			vscode.Uri.file(tempFilePath),
			`${path.basename(absolutePath)}: ${fileExists ? "Original ↔ Claude's Changes" : "New File"} (Editable)`
		)

		const userResponse = await ask(
			"tool",
			JSON.stringify({
				tool: fileExists ? "editedExistingFile" : "newFileCreated",
				path: getReadablePath(relPath, this.cwd),
				[fileExists ? "diff" : "content"]: fileExists
					? this.createPrettyPatch(relPath, originalContent, newContent)
					: newContent,
			} as ClaudeSayTool)
		)

		const { response, text, images } = userResponse

		const diffDocument = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === tempFilePath)
		if (diffDocument && diffDocument.isDirty) {
			await diffDocument.save()
		}

		if (response !== "yesButtonTapped") {
			await this.closeDiffViews()
			try {
				await fs.rm(tempDir, { recursive: true, force: true })
			} catch (error) {
				console.error(`Error deleting temporary directory: ${error}`)
			}

			if (response === "messageResponse") {
				await say("user_feedback", text, images)
				return formatToolResponse(formatGenericToolFeedback(text), images)
			}

			return "The user denied this operation."
		}

		const editedContent = await fs.readFile(tempFilePath, "utf-8")
		if (!fileExists) {
			await fs.mkdir(path.dirname(absolutePath), { recursive: true })
		}
		await fs.writeFile(absolutePath, editedContent)

		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch (error) {
			console.error(`Error deleting temporary directory: ${error}`)
		}

		await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
		await this.closeDiffViews()

		if (editedContent !== newContent) {
			const diffResult = diff.createPatch(relPath, originalContent, editedContent)
			const userDiff = diff.createPatch(relPath, newContent, editedContent)
			await say(
				"user_feedback_diff",
				JSON.stringify({
					tool: fileExists ? "editedExistingFile" : "newFileCreated",
					path: getReadablePath(relPath, this.cwd),
					diff: this.createPrettyPatch(relPath, newContent, editedContent),
				} as ClaudeSayTool)
			)

			return `The user accepted but made the following changes to your content:\n\n${userDiff}\n\nFinal result ${
				fileExists ? "applied to" : "written as new file"
			} ${relPath}:\n\n${diffResult}`
		} else {
			const diffResult = diff.createPatch(relPath, originalContent, newContent)
			return `${
				fileExists ? `Changes applied to ${relPath}:\n\n${diffResult}` : `New file written to ${relPath}`
			}`
		}
	}

	private async closeDiffViews() {
		const tabs = vscode.window.tabGroups.all
			.map((tg) => tg.tabs)
			.flat()
			.filter((tab) => tab.input instanceof vscode.TabInputTextDiff && tab.input?.modified?.scheme === "kodu")

		for (const tab of tabs) {
			await vscode.window.tabGroups.close(tab)
		}
	}

	private createPrettyPatch(filename = "file", oldStr: string, newStr: string) {
		const patch = diff.createPatch(filename, oldStr, newStr)
		const lines = patch.split("\n")
		const prettyPatchLines = lines.slice(4)

		return prettyPatchLines.join("\n")
	}

	/**
	 * Asynchronously creates all non-existing subdirectories for a given file path
	 * and collects them in an array for later deletion.
	 *
	 * @param filePath - The full path to a file.
	 * @returns A promise that resolves to an array of newly created directories.
	 */
	async createDirectoriesForFile(filePath: string): Promise<string[]> {
		const newDirectories: string[] = []
		const normalizedFilePath = path.normalize(filePath) // Normalize path for cross-platform compatibility
		const directoryPath = path.dirname(normalizedFilePath)

		let currentPath = directoryPath
		const dirsToCreate: string[] = []

		// Traverse up the directory tree and collect missing directories
		while (!(await this.exists(currentPath))) {
			dirsToCreate.push(currentPath)
			currentPath = path.dirname(currentPath)
		}

		// Create directories from the topmost missing one down to the target directory
		for (let i = dirsToCreate.length - 1; i >= 0; i--) {
			await fs.mkdir(dirsToCreate[i])
			newDirectories.push(dirsToCreate[i])
		}

		return newDirectories
	}

	/**
	 * Helper function to check if a path exists.
	 *
	 * @param path - The path to check.
	 * @returns A promise that resolves to true if the path exists, false otherwise.
	 */
	async exists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}
}
