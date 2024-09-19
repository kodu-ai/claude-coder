import { ToolResponse } from "../types"
import { BaseAgentTool } from "./base-agent.tool"
import type { AgentToolOptions, AgentToolParams } from "./types"

export class AskConsultantTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { say, ask, input } = this.params
		const { query } = input

		if (!query) {
			await say("error", "Claude tried to use `ask_consultant` without required parameter `query`. Retrying...")

			return `Error: Missing value for required parameter 'query'. Please retry with complete response.
				A good example of a ask_consultant tool call is:
				{
					"tool": "ask_consultant",
					"query": "I want to build a multiplayer game where 100 players would be playing together at once. What framework should I choose for the backend? I'm confused between Elixir and colyseus",
				}
				Please try again with the correct query, you are not allowed to search without a query.`
		}

		try {
			const response = await this.koduDev.getApiManager().getApi()?.sendAskConsultantRequest?.(query)
			if (!response || !response.result) {
				return "Consultant failed to answer your question."
			}

			return `This is the advice from the consultant: ${response.result}`
		} catch (err) {
			return `Consultant failed to answer your question with the error: ${err}`
		}
	}
}
