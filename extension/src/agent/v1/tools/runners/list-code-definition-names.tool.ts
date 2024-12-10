import * as path from "path"
import { serializeError } from "serialize-error"

import { parseSourceCodeForDefinitionsTopLevel } from "../../../../parse-source-code"
import { ClaudeSayTool } from "../../../../shared/extension-message"
import { ToolResponse } from "../../types"
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../../utils"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"

export class ListCodeDefinitionNamesTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute() {
		const { input, ask, say } = this.params
		const { path: relDirPath } = input

		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use list_code_definition_names without value for required parameter 'path'. Retrying..."
			)
			const errorMsg = `
			<code_definitions_response>
				<status>
					<result>error</result>
					<operation>list_code_definitions</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<error_details>
					<type>missing_parameter</type>
					<message>Missing required parameter 'path'</message>
					<help>
						<example_usage>
							<tool>list_code_definition_names</tool>
							<parameters>
								<path>path/to/directory</path>
							</parameters>
						</example_usage>
						<note>A valid directory path is required to list code definitions</note>
					</help>
				</error_details>
			</code_definitions_response>`
			return this.toolResponse("error", errorMsg)
		}

		try {
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const result = await parseSourceCodeForDefinitionsTopLevel(absolutePath)

			const { response, text, images } = await ask!(
				"tool",
				{
					tool: {
						tool: "list_code_definition_names",
						path: getReadablePath(relDirPath),
						approvalState: "pending",
						content: result,
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
							tool: "list_code_definition_names",
							path: getReadablePath(relDirPath),
							approvalState: "rejected",
							content: result,
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
								tool: "list_code_definition_names",
								userFeedback: text,
								approvalState: "rejected",
								ts: this.ts,
								path: getReadablePath(relDirPath),
							},
						},
						this.ts
					)
					await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
					return this.toolResponse(
						"feedback",
						`<code_definitions_response>
							<status>
								<result>feedback</result>
								<operation>list_code_definitions</operation>
								<timestamp>${new Date().toISOString()}</timestamp>
							</status>
							<feedback_details>
								<directory>${getReadablePath(relDirPath)}</directory>
								<user_feedback>${text || "No feedback provided"}</user_feedback>
								${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
							</feedback_details>
						</code_definitions_response>`,
						images
					)
				}
				return this.toolResponse(
					"rejected",
					`<code_definitions_response>
						<status>
							<result>rejected</result>
							<operation>list_code_definitions</operation>
							<timestamp>${new Date().toISOString()}</timestamp>
						</status>
						<rejection_details>
							<directory>${getReadablePath(relDirPath)}</directory>
							<message>Operation was rejected by the user</message>
						</rejection_details>
					</code_definitions_response>`
				)
			}
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "list_code_definition_names",
						path: getReadablePath(relDirPath),
						approvalState: "approved",
						content: result,
						ts: this.ts,
					},
				},
				this.ts
			)
			return this.toolResponse(
				"success",
				`<code_definitions_response>
					<status>
						<result>success</result>
						<operation>list_code_definitions</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<analysis_info>
						<directory>${getReadablePath(relDirPath)}</directory>
						<content_type>code_definitions</content_type>
					</analysis_info>
					<definitions>
						${result}
					</definitions>
				</code_definitions_response>`
			)
		} catch (error) {
			const errorString = `
			<code_definitions_response>
				<status>
					<result>error</result>
					<operation>list_code_definitions</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<error_details>
					<type>parsing_error</type>
					<message>Failed to parse source code definitions</message>
					<context>
						<directory>${getReadablePath(relDirPath)}</directory>
						<error_data>${JSON.stringify(serializeError(error))}</error_data>
					</context>
				</error_details>
			</code_definitions_response>`
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "list_code_definition_names",
						approvalState: "rejected",
						path: getReadablePath(relDirPath),
						error: errorString,
						ts: this.ts,
					},
				},
				this.ts
			)

			return this.toolResponse("error", errorString)
		}
	}
}
