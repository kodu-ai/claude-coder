import * as path from "path"
import { serializeError } from "serialize-error"
import dedent from "dedent"
import { z } from "zod"

import { getReadablePath } from "../../../utils"
import { BaseAgentTool } from "../../base-agent.tool"
import { extractTextFromFile, formatFileToLines } from "./utils"
import { ReadFileToolParams } from "../../schema/read_file"

export class ReadFileTool extends BaseAgentTool<ReadFileToolParams> {
	async execute() {
		const { input, ask, say } = this.params

		const { path: relPath, pageNumber, readAllPages } = input

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
						pageNumber,
						readAllPages,
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
							pageNumber,
							readAllPages,
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
						pageNumber,
						readAllPages,
						ts: this.ts,
					},
				},
				this.ts
			)

			if (content.trim().length === 0) {
				return this.toolResponse(
					"success",
					dedent`
						<file_read_response>
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

			// Format content into lines
			const lines = formatFileToLines(content)
			const linesArray = lines.split("\n")

			// Pagination logic
			const LINES_PER_PAGE = 700
			const totalLines = linesArray.length
			const totalPages = Math.ceil(totalLines / LINES_PER_PAGE)

			let finalPageNumber = pageNumber ?? 1
			let pageContent = ""
			let currentPage: string | number = finalPageNumber

			if (readAllPages) {
				// Return all content if readAllPages is true
				pageContent = lines
				currentPage = "all"
			} else {
				// Ensure pageNumber is within valid range
				if (finalPageNumber < 1) {
					finalPageNumber = 1
				}
				if (finalPageNumber > totalPages) {
					finalPageNumber = totalPages
				}

				const start = (finalPageNumber - 1) * LINES_PER_PAGE
				const end = start + LINES_PER_PAGE
				pageContent = linesArray.slice(start, end).join("\n")
				currentPage = finalPageNumber
			}

			return this.toolResponse(
				"success",
				dedent`
					<file_read_response>
					  <status>
					    <result>success</result>
					    <operation>file_read</operation>
					    <timestamp>${new Date().toISOString()}</timestamp>
					  </status>
					  <file_info>
					    <path>${relPath}</path>
					    <content_length>${content.length}</content_length>
					    <count_lines>${totalLines}</count_lines>
					  </file_info>
					  <page_info>
					    <total_pages>${totalPages}</total_pages>
					    <current_page>${currentPage}</current_page>
					  </page_info>
					  <content>${pageContent}</content>
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
						pageNumber: pageNumber ?? readAllPages ? undefined : 1,
						readAllPages,
						ts: this.ts,
					},
				},
				this.ts
			)
			const errorString = dedent`
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
