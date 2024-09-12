import { serializeError } from "serialize-error"

import { ToolResponse } from "../types"
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../utils"

import { extractTextFromFile } from "../../../utils/extract-text"
import { AgentToolOptions, AgentToolParams } from "./types"
import { BaseAgentTool } from "./base-agent.tool"
import { ClaudeSayTool } from "../../../shared/ExtensionMessage"

export class ReadFileTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { path: relPath } = input

		if (relPath === undefined) {
			await say("error", "Claude tried to use read_file without value for required parameter 'path'. Retrying...")

			return `Error: Missing value for required parameter 'path'. Please retry with complete response.
			An example of a good readFile tool call is:
			{
				"tool": "read_file",
				"path": "path/to/file.txt"
			}
			Please try again with the correct path, you are not allowed to read files without a path.
			`
		}
		try {
			const absolutePath = this.adapter.pathUtil().resolve(this.cwd, relPath)
			const content = await extractTextFromFile(absolutePath)

			const message = JSON.stringify({
				tool: "readFile",
				path: getReadablePath(relPath, this.cwd),
				content,
			} as ClaudeSayTool)
			if (this.alwaysAllowReadOnly) {
				await say("tool", message)
			} else {
				const { response, text, images } = await ask("tool", message)

				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await say("user_feedback", text, images)
						return formatToolResponse(formatGenericToolFeedback(text), images)
					}

					return "The user denied this operation."
				}
			}

			return content
		} catch (error) {
			const errorString = `
			Error reading file: ${JSON.stringify(serializeError(error))}
			An example of a good readFile tool call is:
			{
				"tool": "read_file",
				"path": "path/to/file.txt"
			}
			Please try again with the correct path, you are not allowed to read files without a path.
			`
			await say(
				"error",
				`Error reading file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
			)

			return errorString
		}
	}
}
