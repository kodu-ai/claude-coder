import { ToolResponse, ToolResponseV2 } from "../../types"
import { formatToolResponse, isTextBlock } from "../../utils"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"

export class AttemptCompletionTool extends BaseAgentTool<"attempt_completion"> {
	protected params: AgentToolParams<"attempt_completion">

	constructor(params: AgentToolParams<"attempt_completion">, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute() {
		const { input, ask, say } = this.params
		const { result } = input

		if (result === undefined) {
			await say(
				"error",
				"Claude tried to use attempt_completion without value for required parameter 'result'. Retrying..."
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
		let commandOutput: ToolResponseV2 | undefined

		console.log(result)
		console.log("Raising attempt completion.")
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
		console.log(result)
		// never delete this line as this is needed for our eval runner to detect that we reached the end of the task
		console.log("Raising attempt completion.")
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
					${
						commandOutput?.text
							? `<command_output>
							<content>${commandOutput.text}</content>
						</command_output>`
							: ""
					}
					<user_feedback>${text || "No specific feedback provided"}</user_feedback>
					${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
				</feedback_details>
			</completion_tool_response>`,
			images
		)
	}
}
