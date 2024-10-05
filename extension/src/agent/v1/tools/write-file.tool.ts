import * as diff from "diff"
import fs from "fs/promises"
import * as path from "path"
import { serializeError } from "serialize-error"
import * as vscode from "vscode"
import { ClaudeAsk, ClaudeSay, ClaudeSayTool } from "../../../shared/ExtensionMessage"
import { ToolResponse } from "../types"
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../utils"
import os from "os"
import { ClaudeAskResponse } from "../../../shared/WebviewMessage"
import { AgentToolOptions, AgentToolParams } from "./types"
import { BaseAgentTool } from "./base-agent.tool"
import { DiagnosticsHandler } from "../handlers"

export class WriteFileTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { path: relPath, content } = input
		let newContent = content

		if (!newContent || !relPath) {
			return await this.onBadInputReceived()
		}

		try {
			const absolutePath = path.resolve(this.cwd, relPath)
			const fileExists = await fs
				.access(absolutePath)
				.then(() => true)
				.catch(() => false)

			let originalContent: string = fileExists ? await fs.readFile(absolutePath, "utf-8") : ""

			if (fileExists) {
				const eol = originalContent.includes("\r\n") ? "\r\n" : "\n"
				if (originalContent.endsWith(eol) && !newContent.endsWith(eol)) {
					newContent += eol
				}
			}

			let response: ToolResponse
			if (this.alwaysAllowWriteOnly) {
				response = await this.writeFileDirectly(absolutePath, newContent, fileExists, relPath, say)
			} else {
				response = await this.writeFileWithUserApproval(
					absolutePath,
					originalContent,
					newContent,
					fileExists,
					relPath,
					ask,
					say
				)
			}

			const diagnosticsHandler = this.options.koduDev.diagnosticsHandler
			const generatedErrors = diagnosticsHandler.getErrorsGeneratedByLastStep()
			diagnosticsHandler.updateSeenErrors()

			if (generatedErrors.length > 0) {
				return response + DiagnosticsHandler.errorsToString(generatedErrors, this.cwd)
			}

			return response
		} catch (error) {
			const errorString = `Error writing file: ${JSON.stringify(serializeError(error))}
						A good example of a writeToFile tool call is:
			{
				"tool": "write_to_file",
				"path": "path/to/file.txt",
				"content": "new content"
			}
			Please try again with the correct path and content, you are not allowed to write files without a path.
			`

			await say(
				"error",
				`Error writing file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
			)
			return errorString
		}
	}

	private async onBadInputReceived(): Promise<ToolResponse> {
		const { input, say } = this.params
		const { path: relPath, content: newContent } = input

		if (relPath === undefined) {
			await say(
				"error",
				"Claude tried to use write_to_file without value for required parameter 'path'. Retrying..."
			)

			return `Error: Missing value for required parameter 'path'. Please retry with complete response.
			A good example of a writeToFile tool call is:
			{
				"tool": "write_to_file",
				"path": "path/to/file.txt",
				"content": "new content"
			}
			Please try again with the correct path and content, you are not allowed to write files without a path.
			`
		}

		await say(
			"error",
			`Claude tried to use write_to_file for '${relPath}' without value for required parameter 'content'. This is likely due to output token limits. Retrying...`
		)

		return `Error: Missing value for required parameter 'content'. Please retry with complete response.
						A good example of a writeToFile tool call is:
			{
				"tool": "write_to_file",
				"path": "path/to/file.txt",
				"content": "new content"
			}
			Please try again with the correct path and content, you are not allowed to write files without a path.
			`
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
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "claude-coder-"))
		const tempFilePath = path.join(tempDir, path.basename(absolutePath))
		await fs.writeFile(tempFilePath, newContent)

		vscode.commands.executeCommand(
			"vscode.diff",
			vscode.Uri.parse(`claude-coder-diff:${path.basename(absolutePath)}`).with({
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
}
