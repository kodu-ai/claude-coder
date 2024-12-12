import * as path from "path"
import { serializeError } from "serialize-error"
import { LIST_FILES_LIMIT, listFiles } from "../../../../parse-source-code"
import { getReadablePath } from "../../utils"
import { BaseAgentTool } from "../base-agent.tool"
import { ListFilesToolParams } from "../schema/list_files"

export class ListFilesTool extends BaseAgentTool<ListFilesToolParams> {
	async execute() {
		const { input, ask, say } = this.params
		const { path: relDirPath, recursive: recursiveRaw } = input

		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use list_files without value for required parameter 'path'. Retrying..."
			)
			const errorMsg = `
			<file_list_response>
				<status>
					<result>error</result>
					<operation>list_files</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<error_details>
					<type>missing_parameter</type>
					<message>Missing required parameter 'path'</message>
					<help>
						<example_usage>
							<tool>list_files</tool>
							<parameters>
								<path>path/to/directory</path>
								<recursive>true</recursive>
							</parameters>
						</example_usage>
						<note>A valid directory path is required to list files</note>
					</help>
				</error_details>
			</file_list_response>`
			return this.toolResponse("error", errorMsg)
		}

		try {
			const recursive = recursiveRaw?.toLowerCase() === "true"
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const files = await listFiles(absolutePath, recursive, 200)
			const result = this.formatFilesList(absolutePath, files[0])

			const { response, text, images } = await ask!(
				"tool",
				{
					tool: {
						tool: "list_files",
						path: getReadablePath(relDirPath, this.cwd),
						approvalState: "pending",
						content: result,
						recursive: recursive ? "true" : "false",
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
							tool: "list_files",
							path: getReadablePath(relDirPath, this.cwd),
							approvalState: "rejected",
							recursive: recursive ? "true" : "false",
							ts: this.ts,
						},
					},
					this.ts
				)
				if (response === "messageResponse") {
					// await say("user_feedback", text, images)
					await this.params.updateAsk(
						"tool",
						{
							tool: {
								tool: "list_files",
								userFeedback: text,
								approvalState: "rejected",
								ts: this.ts,
								path: getReadablePath(relDirPath, this.cwd),
								recursive: recursive ? "true" : "false",
							},
						},
						this.ts
					)
					await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
					return this.toolResponse(
						"feedback",
						`<file_list_response>
							<status>
								<result>feedback</result>
								<operation>list_files</operation>
								<timestamp>${new Date().toISOString()}</timestamp>
							</status>
							<feedback_details>
								<directory>${getReadablePath(relDirPath, this.cwd)}</directory>
								<recursive>${recursive}</recursive>
								<user_feedback>${text || "No feedback provided"}</user_feedback>
								${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
							</feedback_details>
						</file_list_response>`,
						images
					)
				}

				return this.toolResponse(
					"rejected",
					`<file_list_response>
						<status>
							<result>rejected</result>
							<operation>list_files</operation>
							<timestamp>${new Date().toISOString()}</timestamp>
						</status>
						<rejection_details>
							<directory>${getReadablePath(relDirPath, this.cwd)}</directory>
							<recursive>${recursive}</recursive>
							<message>Operation was rejected by the user</message>
						</rejection_details>
					</file_list_response>`
				)
			}

			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "list_files",
						path: getReadablePath(relDirPath, this.cwd),
						approvalState: "approved",
						content: result,
						recursive: recursive ? "true" : "false",
						ts: this.ts,
					},
				},
				this.ts
			)

			return this.toolResponse(
				"success",
				`<file_list_response>
					<status>
						<result>success</result>
						<operation>list_files</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<directory_info>
						<path>${getReadablePath(relDirPath, this.cwd)}</path>
						<recursive>${recursive}</recursive>
					</directory_info>
					<files>
						${result}
					</files>
				</file_list_response>`
			)
		} catch (error) {
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "list_files",
						path: getReadablePath(relDirPath, this.cwd),
						approvalState: "error",
						error: serializeError(error).message,
						ts: this.ts,
					},
				},
				this.ts
			)
			const errorString = `
			<file_list_response>
				<status>
					<result>error</result>
					<operation>list_files</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<error_details>
					<type>listing_error</type>
					<message>Failed to list files and directories</message>
					<context>
						<directory>${getReadablePath(relDirPath, this.cwd)}</directory>
						<error_data>${JSON.stringify(serializeError(error))}</error_data>
					</context>
				</error_details>
			</file_list_response>`
			await say(
				"error",
				`Error listing files and directories:\n${
					(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)
				}`
			)

			return this.toolResponse("error", errorString)
		}
	}

	formatFilesList(absolutePath: string, files: string[]): string {
		const sorted = files
			.map((file) => {
				// convert absolute path to relative path
				const relativePath = path.relative(absolutePath, file)
				return file.endsWith("/") ? relativePath + "/" : relativePath
			})
			// Sort so files are listed under their respective directories to make it clear what files are children of what directories. Since we build file list top down, even if file list is Compressed it will show directories that claude can then explore further.
			.sort((a, b) => {
				const aParts = a.split("/")
				const bParts = b.split("/")
				for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
					if (aParts[i] !== bParts[i]) {
						// If one is a directory and the other isn't at this level, sort the directory first
						if (i + 1 === aParts.length && i + 1 < bParts.length) {
							return -1
						}
						if (i + 1 === bParts.length && i + 1 < aParts.length) {
							return 1
						}
						// Otherwise, sort alphabetically
						return aParts[i].localeCompare(bParts[i], undefined, { numeric: true, sensitivity: "base" })
					}
				}
				// If all parts are the same up to the length of the shorter path,
				// the shorter one comes first
				return aParts.length - bParts.length
			})
		if (sorted.length >= LIST_FILES_LIMIT) {
			const truncatedList = sorted.slice(0, LIST_FILES_LIMIT).join("\n")
			return `<file_entries>
				<status>truncated</status>
				<entries>
					${sorted
						.slice(0, LIST_FILES_LIMIT)
						.map((file) => `<entry>${file}</entry>`)
						.join("\n")}
				</entries>
				<truncation_info>
					<limit>${LIST_FILES_LIMIT}</limit>
					<message>Results truncated. Try listing files in subdirectories if you need to explore further.</message>
				</truncation_info>
			</file_entries>`
		} else if (sorted.length === 0 || (sorted.length === 1 && sorted[0] === "")) {
			return `<file_entries>
				<status>empty</status>
				<message>No files found or you do not have permission to view this directory</message>
			</file_entries>`
		} else {
			return `<file_entries>
				${sorted.map((file) => `<entry>${file}</entry>`).join("\n")}
			</file_entries>`
		}
	}
}
