import * as path from "path"
import { serializeError } from "serialize-error"
import { BaseAgentTool } from "../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../types"
import { getReadablePath } from "../../utils"

export class AddInterestedFileTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute() {
		const { input, ask, say } = this.params
		const { path: relPath, why } = input

		if (!relPath) {
			await say(
				"error",
				"Claude tried to use add_interested_file without value for required parameter 'path'. Retrying..."
			)

			const errorMsg = `
            <add_interested_file_response>
                <status>
                    <result>error</result>
                    <operation>add_interested_file</operation>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <error_details>
                    <type>missing_parameter</type>
                    <message>Missing required parameter 'path'</message>
                    <help>
                        <example_usage>
                            <tool>add_interested_file</tool>
                            <parameters>
                                <path>path/to/file</path>
                                <why>Explanation of relevance</why>
                            </parameters>
                        </example_usage>
                        <note>Both path and why parameters are required</note>
                    </help>
                </error_details>
            </add_interested_file_response>`
			return this.toolResponse("error", errorMsg)
		}

		if (!why) {
			await say(
				"error",
				"Claude tried to use add_interested_file without value for required parameter 'why'. Retrying..."
			)

			const errorMsg = `
            <add_interested_file_response>
                <status>
                    <result>error</result>
                    <operation>add_interested_file</operation>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <error_details>
                    <type>missing_parameter</type>
                    <message>Missing required parameter 'why'</message>
                    <help>
                        <example_usage>
                            <tool>add_interested_file</tool>
                            <parameters>
                                <path>path/to/file</path>
                                <why>Explanation of relevance</why>
                            </parameters>
                        </example_usage>
                        <note>Both path and why parameters are required</note>
                    </help>
                </error_details>
            </add_interested_file_response>`
			return this.toolResponse("error", errorMsg)
		}

		try {
			const absolutePath = path.resolve(this.cwd, relPath)

			const { response, text, images } = await ask!(
				"tool",
				{
					tool: {
						tool: "add_interested_file",
						path: getReadablePath(relPath, this.cwd),
						why,
						approvalState: "pending",
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
							tool: "add_interested_file",
							path: getReadablePath(relPath, this.cwd),
							why,
							approvalState: "rejected",
							ts: this.ts,
						},
					},
					this.ts
				)

				if (response === "messageResponse") {
					await this.params.updateAsk(
						"tool",
						{
							tool: {
								tool: "add_interested_file",
								userFeedback: text,
								approvalState: "rejected",
								ts: this.ts,
								path: getReadablePath(relPath, this.cwd),
								why,
							},
						},
						this.ts
					)
					await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
					return this.toolResponse(
						"feedback",
						`<add_interested_file_response>
                            <status>
                                <result>feedback</result>
                                <operation>add_interested_file</operation>
                                <timestamp>${new Date().toISOString()}</timestamp>
                            </status>
                            <feedback_details>
                                <file>${getReadablePath(relPath, this.cwd)}</file>
                                <reason>${why}</reason>
                                <user_feedback>${text || "No feedback provided"}</user_feedback>
                                ${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
                            </feedback_details>
                        </add_interested_file_response>`,
						images
					)
				}

				return this.toolResponse(
					"rejected",
					`<add_interested_file_response>
                        <status>
                            <result>rejected</result>
                            <operation>add_interested_file</operation>
                            <timestamp>${new Date().toISOString()}</timestamp>
                        </status>
                        <rejection_details>
                            <file>${getReadablePath(relPath, this.cwd)}</file>
                            <reason>${why}</reason>
                            <message>File tracking was rejected by the user</message>
                        </rejection_details>
                    </add_interested_file_response>`
				)
			}

			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "add_interested_file",
						path: getReadablePath(relPath, this.cwd),
						why,
						approvalState: "approved",
						ts: this.ts,
					},
				},
				this.ts
			)

			return this.toolResponse(
				"success",
				`<add_interested_file_response>
                    <status>
                        <result>success</result>
                        <operation>add_interested_file</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <tracking_info>
                        <file>${getReadablePath(relPath, this.cwd)}</file>
                        <reason>${why}</reason>
                    </tracking_info>
                </add_interested_file_response>`
			)
		} catch (error) {
			const errorString = `
            <add_interested_file_response>
                <status>
                    <result>error</result>
                    <operation>add_interested_file</operation>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <error_details>
                    <type>tracking_error</type>
                    <message>Failed to track file</message>
                    <context>
                        <file>${getReadablePath(relPath, this.cwd)}</file>
                        <reason>${why}</reason>
                        <error_data>${JSON.stringify(serializeError(error))}</error_data>
                    </context>
                    <help>
                        <example_usage>
                            <tool>add_interested_file</tool>
                            <parameters>
                                <path>path/to/file</path>
                                <why>Explanation of relevance</why>
                            </parameters>
                        </example_usage>
                    </help>
                </error_details>
            </add_interested_file_response>`
			await say(
				"error",
				`Error tracking file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
			)

			return this.toolResponse("error", errorString)
		}
	}
}
