import { ToolResponse } from "../../types"
import { formatToolResponse } from "../../utils"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"

export class AskFollowupQuestionTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute() {
		const { input, ask, say } = this.params
		const { question } = input

		if (question === undefined) {
			await say(
				"error",
				"Claude tried to use ask_followup_question without value for required parameter 'question'. Retrying..."
			)
			const errorMsg = `
			<question_tool_response>
				<status>
					<result>error</result>
					<operation>ask_followup_question</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<error_details>
					<type>missing_parameter</type>
					<message>Missing required parameter 'question'</message>
					<help>
						<example_usage>
							<tool>ask_followup_question</tool>
							<parameters>
								<question>Your question here</question>
							</parameters>
						</example_usage>
						<note>Follow-up questions require a valid question parameter to proceed</note>
					</help>
				</error_details>
			</question_tool_response>`
			return this.toolResponse("error", errorMsg)
		}

		const { text, images } = await ask(
			"tool",
			{
				tool: { tool: "ask_followup_question", question, approvalState: "pending", ts: this.ts },
			},
			this.ts
		)
		this.params.updateAsk(
			"tool",
			{ tool: { tool: "ask_followup_question", question, approvalState: "approved", ts: this.ts } },
			this.ts
		)
		await say("user_feedback", text ?? "", images)

		return this.toolResponse(
			"success",
			`<question_tool_response>
				<status>
					<result>success</result>
					<operation>ask_followup_question</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<interaction>
					<question>${question}</question>
					<response>
						<text>${text || ""}</text>
						${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
					</response>
					<metadata>
						<response_type>${images ? "text_with_images" : "text_only"}</response_type>
						<response_length>${text?.length || 0}</response_length>
					</metadata>
				</interaction>
			</question_tool_response>`,
			images
		)
	}
}
