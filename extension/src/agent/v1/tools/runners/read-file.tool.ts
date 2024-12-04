import * as path from "path"
import { serializeError } from "serialize-error"

import { ToolResponse } from "../../types"
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../../utils"

import { extractTextFromFile } from "../../../../utils/extract-text"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"
import { ClaudeSayTool } from "../../../../shared/ExtensionMessage"

export class ReadFileTool extends BaseAgentTool<"read_file"> {
	protected params: AgentToolParams<"read_file">

	constructor(params: AgentToolParams<"read_file">, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute() {
		const { input, ask, say } = this.params
		const { path: relPath } = input

		if (relPath === undefined) {
			await say("error", "Claude tried to use read_file without value for required parameter 'path'. Retrying...")

			const errorMsg = `Error: Missing value for required parameter 'path'. Please retry with complete response.
			An example of a good readFile tool call is:
			{
				"tool": "read_file",
				"path": "path/to/file.txt"
			}
			Please try again with the correct path, you are not allowed to read files without a path.
			`
			return this.toolResponse("error", errorMsg)
		}
		try {
			const absolutePath = path.resolve(this.cwd, relPath)
			const content = await extractTextFromFile(absolutePath)

			const { response, text, images } = await ask!(
				"tool",
				{
					tool: {
						tool: "read_file",
						path: getReadablePath(relPath, this.cwd),
						approvalState: "pending",
						content,
						ts: this.ts,
					},
				},
				this.ts
			)

			if (response !== "yesButtonTapped") {
				this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "read_file",
							path: getReadablePath(relPath, this.cwd),
							approvalState: "rejected",
							content,
							userFeedback: text,
							ts: this.ts,
						},
					},
					this.ts
				)

				if (response === "messageResponse") {
					await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
					return this.toolResponse("feedback", text, images)
				}

				return this.toolResponse("error", "Read operation cancelled by user.")
			}
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "read_file",
						path: getReadablePath(relPath, this.cwd),
						approvalState: "approved",
						content,
						ts: this.ts,
					},
				},
				this.ts
			)
			if (content.trim().length === 0) {
				return this.toolResponse("success", "The file is empty.")
			}
			return this.toolResponse("success", content.length > 0 ? content : "The file is empty.")
		} catch (error) {
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "read_file",
						path: getReadablePath(relPath, this.cwd),
						content: "Cannot read content",
						approvalState: "error",
						ts: this.ts,
					},
				},
				this.ts
			)
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

			return this.toolResponse("error", errorString)
		}
	}
}
