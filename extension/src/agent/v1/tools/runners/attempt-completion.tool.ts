import { ToolResponse } from "../../types"
import { formatToolResponse, isTextBlock } from "../../utils"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"
import { ExecuteCommandTool } from "./execute-command.tool"

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
				"error",
				"Claude tried to use attempt_completion without value for required parameter 'result'. Retrying..."
			)
			return `Error: Missing value for required parameter 'result'. Please retry with complete response.
			An example of a good attemptCompletion tool call is:
			{
				"tool": "attempt_completion",
				"result": "result to attempt completion with"
			}
			`
		}

		let resultToSend = result
		let commandOutput: ToolResponse | undefined
		if (command) {
			const executeCommandParams: AgentToolParams = {
				...this.params,
				returnEmptyStringOnSuccess: true,
				isSubMsg: true,
				ts: Date.now(), // add a timestamp to the command to ensure it is unique and goes to next msg
			}

			commandOutput = await new ExecuteCommandTool(executeCommandParams, this.options).execute()
		}

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
			return ""
		}

		await say("user_feedback", text ?? "", images)
		return formatToolResponse(
			`The user is not pleased with the results. Use the feedback they provided to successfully complete the task, and then attempt completion again.\n
			${
				commandOutput
					? `<commandOutput>\n${
							typeof commandOutput === "string"
								? commandOutput
								: commandOutput.map((output) => (isTextBlock(output) ? output.text : "")).join("\n")
					  }\n</commandOutput>\n`
					: ""
			}
			<feedback>\n${text}\n</feedback>`,
			images
		)
	}
}
