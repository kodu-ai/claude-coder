import { attemptCompletionPrompt } from "../../prompts/tools/attempt-complete"
import { BaseAgentTool } from "../base-agent.tool"
import { AttemptCompletionToolParams } from "../schema/attempt_completion"

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
						<kodu_action>${attemptCompletionPrompt.examples[0].output}</kodu_action>
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
					approvalState: "pending",
					ts: this.ts,
				},
			},
			this.ts,
			true
		)
		if (response === "yesButtonTapped") {
			await this.koduDev.providerRef
				.deref()
				?.getTaskManager()
				?.markTaskAsCompleted(this.koduDev.getStateManager().taskId, {
					manual: false,
				})
			await this.params.updateAsk(
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

		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "attempt_completion",
					result: resultToSend,
					approvalState: "rejected",
					ts: this.ts,
					userFeedback: response === "noButtonTapped" ? undefined : text,
				},
			},
			this.ts
		)

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
					<action_required>Use the feedback provided to complete the task, YOU MUST GIVE IT A HIGH PRIORITY</action_required>
					<user_feedback>Here is the user feedback please put an extra care to it and make sure to adhere to it even if it means changing your plan:\`\`\`
					${text || "No specific feedback provided"}
					${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
					\`\`\`
					</user_feedback>
				</feedback_details>
			</completion_tool_response>`,
			images
		)
	}
}
