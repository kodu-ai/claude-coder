import delay from "delay"
import { BaseAgentTool } from "../base-agent.tool"
import { AskFollowupQuestionToolParams } from "../schema/ask_followup_question"
import dedent from "dedent"

export class AskFollowupQuestionTool extends BaseAgentTool<AskFollowupQuestionToolParams> {
	async execute() {
		const { input, ask, say } = this.params
		const question = input.question

		if (question === undefined) {
			await say(
				"error",
				"Kodu tried to use ask_followup_question without value for required parameter 'question'. Retrying..."
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
		// let the ask update the approval state
		await this.params.updateAsk(
			"tool",
			{ tool: { tool: "ask_followup_question", question, approvalState: "approved", ts: this.ts } },
			this.ts
		)
		await say("user_feedback", text ?? "", images)

		return this.toolResponse(
			"success",
			dedent`<status>
<result>success</result>
<operation>ask_followup_question</operation>
<timestamp>${new Date().toISOString()}</timestamp>
</status>
<user_feedback>
YOU MUST TAKE IN ACCOUNT THE FOLLOWING FEEDBACK USER FEEDBACK:
${text || "please take a look into the images"}
</user_feedback>`,
			images
		)
	}
}
