import { ToolResponse } from "../../types"
import { formatToolResponse } from "../../utils"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"

export class AskFollowupQuestionTool extends BaseAgentTool<"ask_followup_question"> {
	protected params: AgentToolParams<"ask_followup_question">

	constructor(params: AgentToolParams<"ask_followup_question">, options: AgentToolOptions) {
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
			const errorMsg = `Error: Missing value for required parameter 'question'. Please retry with complete response.
			An example of a good askFollowupQuestion tool call is:
			{
				"tool": "ask_followup_question",
				"question": "question to ask"
			}
			Please try again with the correct question, you are not allowed to ask followup questions without a question.
			`
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

		return this.toolResponse("success", `<answer>\n${text}\n</answer>`, images)
	}
}
