import { ClaudeSayTool } from "../../../../shared/ExtensionMessage"
import { ToolResponse } from "../../types"
import { formatGenericToolFeedback, formatToolResponse } from "../../utils"
import { BaseAgentTool } from "../base-agent.tool"
import type { AgentToolOptions, AgentToolParams, AskConfirmationResponse } from "../types"

export class AskConsultantTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { query } = this.params.input

		if (!query) {
			return await this.onBadInputReceived()
		}

		const confirmation = await this.askToolExecConfirmation()
		if (confirmation.response !== "yesButtonTapped") {
			this.params.ask(
				"tool",
				{
					tool: {
						tool: "ask_consultant",
						approvalState: "rejected",
						query: this.params.input.query!,
						ts: this.ts,
					},
				},
				this.ts
			)
			return await this.onExecDenied(confirmation)
		}
		this.params.ask(
			"tool",
			{
				tool: {
					tool: "ask_consultant",
					approvalState: "loading",
					query: this.params.input.query!,
					ts: this.ts,
				},
			},
			this.ts
		)

		try {
			const response = await this.koduDev.getApiManager().getApi()?.sendAskConsultantRequest?.(query)
			if (!response || !response.result) {
				this.params.ask(
					"tool",
					{
						tool: {
							tool: "ask_consultant",
							approvalState: "error",
							query: this.params.input.query!,
							error: "Consultant failed to answer your question.",
							ts: this.ts,
						},
					},
					this.ts
				)
				return "Consultant failed to answer your question."
			}

			await this.relaySuccessfulResponse(response)

			return `This is the advice from the consultant: ${response.result}`
		} catch (err) {
			this.params.ask(
				"tool",
				{
					tool: {
						tool: "ask_consultant",
						approvalState: "error",
						query: this.params.input.query!,
						error: err,
						ts: this.ts,
					},
				},
				this.ts
			)
			return `Consultant failed to answer your question with the error: ${err}`
		}
	}

	private async onBadInputReceived() {
		await this.params.say(
			"error",
			"Claude tried to use `ask_consultant` without required parameter `query`. Retrying..."
		)

		return `Error: Missing value for required parameter 'query'. Please retry with complete response.
			A good example of a ask_consultant tool call is:
			{
				"tool": "ask_consultant",
				"query": "I want to build a multiplayer game where 100 players would be playing together at once. What framework should I choose for the backend? I'm confused between Elixir and colyseus",
			}
			Please try again with the correct query, you are not allowed to search without a query.`
	}

	private async askToolExecConfirmation(): Promise<AskConfirmationResponse> {
		const { query } = this.params.input

		return await this.params.ask(
			"tool",
			{
				tool: {
					tool: "ask_consultant",
					query: query!,
					approvalState: "pending",
					ts: this.ts,
				},
			},
			this.ts
		)
	}

	private async onExecDenied(confirmation: AskConfirmationResponse) {
		const { response, text, images } = confirmation
		if (response === "messageResponse") {
			await this.params.say("user_feedback", text, images)

			return formatToolResponse(formatGenericToolFeedback(text), images)
		}

		return "The user denied this operation."
	}

	private async relaySuccessfulResponse(data: Record<string, string>) {
		return await this.params.ask(
			"tool",
			{
				tool: {
					tool: "ask_consultant",
					approvalState: "approved",
					result: data.result,
					query: this.params.input.query!,
					ts: this.ts,
				},
			},
			this.ts
		)
	}
}
