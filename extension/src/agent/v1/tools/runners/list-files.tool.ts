import * as path from "path"
import { serializeError } from "serialize-error"
import { LIST_FILES_LIMIT, listFiles } from "../../../../parse-source-code"
import { formatFilesList, getReadablePath } from "../../utils"
import { BaseAgentTool } from "../base-agent.tool"
import { ListFilesToolParams } from "../schema/list_files"
import { listFilesPrompt } from "../../prompts/tools/list-files"

export class ListFilesTool extends BaseAgentTool<ListFilesToolParams> {
	async execute() {
		const { input, ask, say } = this.params
		const { path: relDirPath, recursive: recursiveRaw } = input

		if (relDirPath === undefined) {
			await say("error", "Kodu tried to use list_files without value for required parameter 'path'. Retrying...")
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
						<kodu_action>${listFilesPrompt.examples[0].output}</kodu_action>
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
			const [files, hitLimit] = await listFiles(absolutePath, recursive, 500)
			const result = await formatFilesList(absolutePath, files, hitLimit)

			const { response, text, images } = await ask(
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
				await this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "list_files",
							path: getReadablePath(relDirPath, this.cwd),
							approvalState: "rejected",
							content: result,
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
								content: result,
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

			await this.params.updateAsk(
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
			await this.params.updateAsk(
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
}
