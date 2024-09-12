import * as diff from "diff"
import { serializeError } from "serialize-error"
import { ClaudeAsk, ClaudeSay, ClaudeSayTool } from "../../../shared/ExtensionMessage"
import { ToolResponse } from "../types"
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../utils"
import { ClaudeAskResponse } from "../../../shared/WebviewMessage"
import { AgentToolOptions, AgentToolParams } from "./types"
import { BaseAgentTool } from "./base-agent.tool"

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

		if (newContent === undefined) {
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

		try {
			const absolutePath = this.adapter.pathUtil().resolve(this.cwd, relPath)
			const fileExists = await this.adapter.access(absolutePath)

			let originalContent: string = fileExists ? await this.adapter.readFile(absolutePath, "utf-8") : ""

			if (fileExists) {
				const eol = originalContent.includes("\r\n") ? "\r\n" : "\n"
				if (originalContent.endsWith(eol) && !newContent.endsWith(eol)) {
					newContent += eol
				}
			}

			if (this.alwaysAllowWriteOnly) {
				return await this.writeFileDirectly(absolutePath, newContent, fileExists, relPath, say)
			} else {
				return await this.writeFileWithUserApproval(
					absolutePath,
					originalContent,
					newContent,
					fileExists,
					relPath,
					ask,
					say
				)
			}
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

	private async writeFileDirectly(
		absolutePath: string,
		newContent: string,
		fileExists: boolean,
		relPath: string,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		const path = this.adapter.pathUtil()
		if (!fileExists) {
			await this.adapter.mkdir(path.dirname(absolutePath), { recursive: true })
		}
		await this.adapter.writeFile(absolutePath, newContent)
		await this.adapter.showTextDocument(absolutePath, { preview: false })

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
		const path = this.adapter.pathUtil()
		const tempDir = await this.adapter.createTempDir("claude-dev-")

		const tempFilePath = path.join(tempDir, path.basename(absolutePath))
		await this.adapter.writeFile(tempFilePath, newContent)

		await this.adapter.executeCommand(
			"vscode.diff",
			`claude-dev-diff:${path.basename(absolutePath)}`,
			tempFilePath,
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

		const diffDocument = this.adapter.getWorkspaceTextDocuments().find((doc) => doc.uri.fsPath === tempFilePath)
		if (diffDocument && diffDocument.isDirty) {
			await diffDocument.save()
		}

		if (response !== "yesButtonTapped") {
			await this.adapter.closeDiffViews()
			try {
				await this.adapter.rmdir(tempDir, { recursive: true, force: true })
			} catch (error) {
				console.error(`Error deleting temporary directory: ${error}`)
			}

			if (response === "messageResponse") {
				await say("user_feedback", text, images)
				return formatToolResponse(formatGenericToolFeedback(text), images)
			}

			return "The user denied this operation."
		}

		const editedContent = await this.adapter.readFile(tempFilePath, "utf-8")
		if (!fileExists) {
			await this.adapter.mkdir(path.dirname(absolutePath), { recursive: true })
		}
		await this.adapter.writeFile(absolutePath, editedContent)

		try {
			await this.adapter.rmdir(tempDir, { recursive: true, force: true })
		} catch (error) {
			console.error(`Error deleting temporary directory: ${error}`)
		}

		await this.adapter.showTextDocument(absolutePath, { preview: false })
		await this.adapter.closeDiffViews()

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

	private createPrettyPatch(filename = "file", oldStr: string, newStr: string) {
		const patch = diff.createPatch(filename, oldStr, newStr)
		const lines = patch.split("\n")
		const prettyPatchLines = lines.slice(4)

		return prettyPatchLines.join("\n")
	}
}
