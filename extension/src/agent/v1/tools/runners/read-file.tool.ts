import * as path from "path"
import { serializeError } from "serialize-error"

import { ToolResponse } from "../../types"
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../../utils"

import { extractTextFromFile } from "../../../../utils/extract-text"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"
import { ClaudeSayTool } from "../../../../shared/extension-message"

export class ReadFileTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
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
				return this.toolResponse(
					"success",
					`<file_read_response>
						<status>
							<result>success</result>
							<operation>file_read</operation>
							<timestamp>${new Date().toISOString()}</timestamp>
						</status>
						<file_info>
							<path>${relPath}</path>
							<state>empty</state>
						</file_info>
					</file_read_response>`
				)
			}
			/**
			 *
			 * @param content the file content
			 * @returns LINE NUNMBER CONTENT
			 */
			const formatFileToLines = (content: string) => {
				const lines = content.split("\n")
				const lineNumbers = lines.map((line, index) => `${index + 1}`.padStart(4, " "))
				return lines.map((line, index) => `${lineNumbers[index]} ${line}`).join("\n")
			}
			const lines = formatFileToLines(content)
			return this.toolResponse(
				"success",
				`<file_read_response>
					<status>
						<result>success</result>
						<operation>file_read</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<file_info>
						<path>${relPath}</path>
						<content_length>${content.length}</content_length>
						<count_lines>${lines.split("\n").length}</count_lines>
					</file_info>
					<content>${lines}</content>
				</file_read_response>`
			)
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
			<file_read_response>
				<status>
					<result>error</result>
					<operation>file_read</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<error_details>
					<message>Error reading file: ${JSON.stringify(serializeError(error))}</message>
					<path>${relPath}</path>
					<help>
						<example_usage>
							<tool>read_file</tool>
							<path>path/to/file.txt</path>
						</example_usage>
						<note>Please provide a valid file path. File reading operations require a valid path parameter.</note>
					</help>
				</error_details>
			</file_read_response>
			`
			await say(
				"error",
				`Error reading file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
			)

			return this.toolResponse("error", errorString)
		}
	}
}
