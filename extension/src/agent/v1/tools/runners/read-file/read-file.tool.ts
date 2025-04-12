import * as path from "path"
import { serializeError } from "serialize-error"
import dedent from "dedent"
import { z } from "zod"

import { getReadablePath } from "../../../utils"
import { BaseAgentTool } from "../../base-agent.tool"
import { extractTextFromFile, formatFileToLines } from "./utils"
import { ReadFileToolParams } from "../../definitions"
import { readFilePrompt } from "../../../prompts/tools/read-file"

export class ReadFileTool extends BaseAgentTool<ReadFileToolParams> {
	async execute() {
		const { input, ask, say } = this.params

		const { path: relPath } = input

		try {
			const absolutePath = path.resolve(this.cwd, relPath)
			const content = await extractTextFromFile(absolutePath)

			const { response, text, images } = await ask(
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
				await this.params.updateAsk(
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

			await this.params.updateAsk(
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
					dedent`<file_read_response><status><result>success</result><operation>file_read</operation><timestamp>${new Date().toISOString()}</timestamp></status><file_info><path>${relPath}</path><state>empty</state></file_info></file_read_response>`
				)
			}

			// Format content into lines
			const lines = formatFileToLines(content)

			const now = new Date().toISOString()
			return this.toolResponse(
				"success",
				`<file_read_response><status><result>success</result><operation>file_read</operation><timestamp>${now}</timestamp></status><content>Here is the latest file content as of (${now}):\n${content}</content></file_read_response>`
			)
		} catch (error) {
			await this.params.updateAsk(
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
			const errorString = dedent`<file_read_response><status><result>error</result><operation>file_read</operation><timestamp>${new Date().toISOString()}</timestamp></status><error_details><message>Error reading file: ${JSON.stringify(
				serializeError(error)
			)}</message><path>${relPath}</path><help><example_usage><kodu_action>${
				readFilePrompt.examples[0].output
			}</kodu_action></example_usage><note>Please provide a valid file path. File reading operations require a valid path parameter.</note></help></error_details></file_read_response>`

			await say(
				"error",
				`Error reading file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
			)

			return this.toolResponse("error", errorString)
		}
	}
}
