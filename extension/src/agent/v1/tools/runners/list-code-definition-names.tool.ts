import * as path from "path"
import { serializeError } from "serialize-error"
import { parseSourceCodeForDefinitionsTopLevel } from "../../../../parse-source-code"
import { BaseAgentTool } from "../base-agent.tool"
import { ListCodeDefinitionNamesToolParams } from "../schema/list_code_definition_names"
import { getReadablePath } from "../../utils"

export class ListCodeDefinitionNamesTool extends BaseAgentTool<ListCodeDefinitionNamesToolParams> {
	async execute() {
		const { input, ask, say } = this.params
		const relDirPath = input.path

		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use list_code_definition_names without value for required parameter 'path'. Retrying..."
			)

			return this.toolResponse(
				"error",
				`
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
			)
		}

		try {
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const result = await parseSourceCodeForDefinitionsTopLevel(absolutePath)

			const { response, text, images } = await ask(
				"tool",
				{
					tool: {
						tool: "list_code_definition_names",
						path: getReadablePath(relDirPath, this.cwd),
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
							path: getReadablePath(relDirPath, this.cwd),
							approvalState: "rejected",
							content: result,
							userFeedback: text,
							ts: this.ts,
						},
					},
					this.ts
				)

				if (response === "messageResponse") {
					await say("user_feedback", text ?? "The user denied this operation.", images)
					return this.toolResponse("feedback", text, images)
				}

				return this.toolResponse("error", "Operation cancelled by user.")
			}

			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "list_code_definition_names",
						path: getReadablePath(relDirPath, this.cwd),
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
						<directory>${getReadablePath(relDirPath, this.cwd)}</directory>
						<content_type>code_definitions</content_type>
					</analysis_info>
					<definitions>
						${result}
					</definitions>
				</code_definitions_response>`
			)
		} catch (error) {
			await say(
				"error",
				`Error parsing code definitions: ${
					(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)
				}`
			)

			return this.toolResponse(
				"error",
				`<code_definitions_response>
					<status>
						<result>error</result>
						<operation>list_code_definitions</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<error_details>
						<type>parsing_error</type>
						<message>Failed to parse source code definitions</message>
						<context>
							<directory>${getReadablePath(relDirPath, this.cwd)}</directory>
							<error_data>${JSON.stringify(serializeError(error))}</error_data>
						</context>
					</error_details>
				</code_definitions_response>`
			)
		}
	}
}
