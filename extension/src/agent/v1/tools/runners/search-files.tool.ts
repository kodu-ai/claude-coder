import * as path from "path"
import { serializeError } from "serialize-error"
import { getReadablePath } from "../../utils"
import { regexSearchFiles } from "../../../../utils/ripgrep"
import { BaseAgentTool } from "../base-agent.tool"
import { SearchFilesToolParams } from "../schema/search_files"

export class SearchFilesTool extends BaseAgentTool<SearchFilesToolParams> {
	async execute() {
		const { input, ask, say } = this.params
		const { path: relDirPath, regex, filePattern } = input

		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use search_files without value for required parameter 'path'. Retrying..."
			)

			const errorMsg = `
			<search_files_response>
				<status>
					<result>error</result>
					<operation>search_files</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<error_details>
					<type>missing_parameter</type>
					<message>Missing required parameter 'path'</message>
					<help>
						<example_usage>
							<tool>search_files</tool>
							<parameters>
								<path>path/to/directory</path>
								<regex>search pattern</regex>
								<file_pattern>optional glob pattern</file_pattern>
							</parameters>
						</example_usage>
						<note>Both path and regex parameters are required for file searching</note>
					</help>
				</error_details>
			</search_files_response>`
			return this.toolResponse("error", errorMsg)
		}

		if (regex === undefined) {
			await say(
				"error",
				"Claude tried to use search_files without value for required parameter 'regex'. Retrying..."
			)

			const errorMsg = `
			<search_files_response>
				<status>
					<result>error</result>
					<operation>search_files</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<error_details>
					<type>missing_parameter</type>
					<message>Missing required parameter 'regex'</message>
					<help>
						<example_usage>
							<tool>search_files</tool>
							<parameters>
								<path>path/to/directory</path>
								<regex>search pattern</regex>
								<file_pattern>optional glob pattern</file_pattern>
							</parameters>
						</example_usage>
						<note>A valid regex pattern is required for searching files</note>
					</help>
				</error_details>
			</search_files_response>`
			return this.toolResponse("error", errorMsg)
		}

		try {
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const results = await regexSearchFiles(this.cwd, absolutePath, regex, filePattern)

			const { response, text, images } = await ask!(
				"tool",
				{
					tool: {
						tool: "search_files",
						path: getReadablePath(relDirPath, this.cwd),
						regex: regex,
						filePattern: filePattern,
						approvalState: "pending",
						content: results,
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
							tool: "search_files",
							path: getReadablePath(relDirPath, this.cwd),
							regex: regex,
							filePattern: filePattern,
							approvalState: "rejected",
							content: results,
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
								tool: "search_files",
								userFeedback: text,
								approvalState: "rejected",
								ts: this.ts,
								path: getReadablePath(relDirPath, this.cwd),
								regex: regex,
								filePattern: filePattern,
							},
						},
						this.ts
					)
					await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
					return this.toolResponse(
						"feedback",
						`<search_files_response>
							<status>
								<result>feedback</result>
								<operation>search_files</operation>
								<timestamp>${new Date().toISOString()}</timestamp>
							</status>
							<feedback_details>
								<directory>${getReadablePath(relDirPath, this.cwd)}</directory>
								<pattern>${regex}</pattern>
								${filePattern ? `<file_pattern>${filePattern}</file_pattern>` : ""}
								<user_feedback>${text || "No feedback provided"}</user_feedback>
								${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
							</feedback_details>
						</search_files_response>`,
						images
					)
				}

				return this.toolResponse(
					"rejected",
					`<search_files_response>
						<status>
							<result>rejected</result>
							<operation>search_files</operation>
							<timestamp>${new Date().toISOString()}</timestamp>
						</status>
						<rejection_details>
							<directory>${getReadablePath(relDirPath, this.cwd)}</directory>
							<pattern>${regex}</pattern>
							${filePattern ? `<file_pattern>${filePattern}</file_pattern>` : ""}
							<message>Search operation was rejected by the user</message>
						</rejection_details>
					</search_files_response>`
				)
			}

			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "search_files",
						path: getReadablePath(relDirPath, this.cwd),
						regex: regex,
						filePattern: filePattern,
						approvalState: "approved",
						content: results,
						ts: this.ts,
					},
				},
				this.ts
			)

			return this.toolResponse(
				"success",
				`<search_files_response>
					<status>
						<result>success</result>
						<operation>search_files</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<search_info>
						<directory>${getReadablePath(relDirPath, this.cwd)}</directory>
						<pattern>${regex}</pattern>
						${filePattern ? `<file_pattern>${filePattern}</file_pattern>` : ""}
					</search_info>
					<results>
						${results}
					</results>
				</search_files_response>`
			)
		} catch (error) {
			const errorString = `
			<search_files_response>
				<status>
					<result>error</result>
					<operation>search_files</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<error_details>
					<type>search_error</type>
					<message>Failed to search files</message>
					<context>
						<directory>${getReadablePath(relDirPath, this.cwd)}</directory>
						<pattern>${regex}</pattern>
						${filePattern ? `<file_pattern>${filePattern}</file_pattern>` : ""}
						<error_data>${JSON.stringify(serializeError(error))}</error_data>
					</context>
					<help>
						<example_usage>
							<tool>search_files</tool>
							<parameters>
								<path>path/to/directory</path>
								<regex>search pattern</regex>
								<file_pattern>optional glob pattern</file_pattern>
							</parameters>
						</example_usage>
					</help>
				</error_details>
			</search_files_response>`
			await say(
				"error",
				`Error searching files:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
			)

			return this.toolResponse("error", errorString)
		}
	}
}
