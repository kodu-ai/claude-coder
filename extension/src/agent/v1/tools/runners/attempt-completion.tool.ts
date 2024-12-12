import { ToolResponseV2 } from "../../types"
import { BaseAgentTool } from "../base-agent.tool"
import { AttemptCompletionToolParams } from "../schema/attempt_completion"
import { ExecuteCommandTool } from "./execute-command.tool"
import { AgentToolParams } from "../types"

export class AttemptCompletionTool extends BaseAgentTool<AttemptCompletionToolParams> {
	async execute() {
		const { input, ask, say } = this.params
		const { result } = input

		if (result === undefined) {
			await say(
				"error",
				"Kodu tried to use attempt_completion without value for required parameter 'result'. Retrying..."
			)
			const errorMsg = `
			<completion_tool_response>
				<status>
					<result>error</result>
					<operation>attempt_completion</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<error_details>
					<type>missing_parameter</type>
					<message>Missing required parameter 'result'</message>
					<help>
						<example_usage>
							<tool>attempt_completion</tool>
							<parameters>
								<result>Your completion result here</result>
							</parameters>
						</example_usage>
						<note>Completion attempts require a valid result parameter to proceed</note>
					</help>
				</error_details>
			</completion_tool_response>`
			return this.toolResponse("error", errorMsg)
		}

		let resultToSend = result

		const { response, text, images } = await ask(
			"tool",
			{
				tool: {
					tool: "attempt_completion",
					result: resultToSend,
					approvalState: "approved",
					ts: this.ts,
				},
			},
			this.ts
		)
		if (response === "yesButtonTapped") {
			return this.toolResponse(
				"success",
				`<completion_tool_response>
					<status>
						<result>success</result>
						<operation>attempt_completion</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<completion_details>
						<state>approved</state>
						<message>The user is happy with the results</message>
						${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
					</completion_details>
				</completion_tool_response>`,
				images
			)
		}

		await say("user_feedback", text ?? "", images)
		return this.toolResponse(
			"feedback",
			`<completion_tool_response>
				<status>
					<result>feedback</result>
					<operation>attempt_completion</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<feedback_details>
					<state>needs_improvement</state>
					<message>The user is not pleased with the results</message>
					<action_required>Use the feedback provided to complete the task and attempt completion again</action_required>
					<user_feedback>${text || "No specific feedback provided"}</user_feedback>
					${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
				</feedback_details>
			</completion_tool_response>`,
			images
		)
	}
}
