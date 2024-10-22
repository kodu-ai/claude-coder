import type { ToolResponse } from '../../types'
import { formatToolResponse } from '../../utils'
import { BaseAgentTool } from '../base-agent.tool'
import type { AgentToolOptions, AgentToolParams } from '../types'
import { ExecuteCommandTool } from './execute-command.tool'

export class AttemptCompletionTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { result, command } = input

		if (result === undefined) {
			await say(
				'error',
				"Claude tried to use attempt_completion without value for required parameter 'result'. Retrying...",
			)
			return `Error: Missing value for required parameter 'result'. Please retry with complete response.
			An example of a good attemptCompletion tool call is:
			{
				"tool": "attempt_completion",
				"result": "result to attempt completion with"
			}
			`
		}

		const resultToSend = result
		if (command) {
			const executeCommandParams: AgentToolParams = {
				...this.params,
				returnEmptyStringOnSuccess: true,
				isSubMsg: true,
				ts: Date.now(), // add a timestamp to the command to ensure it is unique and goes to next msg
			}

			const commandResult = await new ExecuteCommandTool(executeCommandParams, this.options).execute()

			if (commandResult) {
				return commandResult
			}
		}

		const { response, text, images } = await ask(
			'tool',
			{
				tool: {
					tool: 'attempt_completion',
					result: resultToSend,
					approvalState: 'approved',
					ts: this.ts,
				},
			},
			this.ts,
		)
		if (response === 'yesButtonTapped') {
			return ''
		}

		await say('user_feedback', text ?? '', images)
		return formatToolResponse(
			`The user is not pleased with the results. Use the feedback they provided to successfully complete the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
			images,
		)
	}
}
