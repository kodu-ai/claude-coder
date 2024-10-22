import type { ToolResponse } from '../../types'
import { formatToolResponse } from '../../utils'
import { BaseAgentTool } from '../base-agent.tool'
import type { AgentToolOptions, AgentToolParams } from '../types'

export class AskFollowupQuestionTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { question } = input

		if (question === undefined) {
			await say(
				'error',
				"Claude tried to use ask_followup_question without value for required parameter 'question'. Retrying...",
			)
			return `Error: Missing value for required parameter 'question'. Please retry with complete response.
			An example of a good askFollowupQuestion tool call is:
			{
				"tool": "ask_followup_question",
				"question": "question to ask"
			}
			Please try again with the correct question, you are not allowed to ask followup questions without a question.
			`
		}

		const { text, images } = await ask(
			'tool',
			{
				tool: { tool: 'ask_followup_question', question, approvalState: 'pending', ts: this.ts },
			},
			this.ts,
		)
		ask(
			'tool',
			{ tool: { tool: 'ask_followup_question', question, approvalState: 'approved', ts: this.ts } },
			this.ts,
		)
		await say('user_feedback', text ?? '', images)

		return formatToolResponse(`<answer>\n${text}\n</answer>`, images)
	}
}
