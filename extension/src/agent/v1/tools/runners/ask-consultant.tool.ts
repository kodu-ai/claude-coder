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

	async execute() {
		const { query } = this.params.input

		if (!query) {
			return await this.onBadInputReceived()
		}

		const confirmation = await this.params.ask!(
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

		if (confirmation.response !== "yesButtonTapped") {
			this.params.updateAsk(
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
		this.params.updateAsk(
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
				this.params.updateAsk(
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
				const errorMsg = `
				<consultant_tool_response>
					<status>
						<result>error</result>
						<operation>ask_consultant</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<error_details>
						<type>consultant_error</type>
						<message>Consultant failed to answer your question</message>
						<context>
							<query>${query}</query>
							<error_type>no_response</error_type>
						</context>
					</error_details>
				</consultant_tool_response>`
				return this.toolResponse("error", errorMsg)
			}

			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "ask_consultant",
						approvalState: "approved",
						result: response.result,
						query: this.params.input.query!,
						ts: this.ts,
					},
				},
				this.ts
			)
			const result = `
			<consultant_tool_response>
				<status>
					<result>success</result>
					<operation>ask_consultant</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<interaction>
					<query>${query}</query>
					<response>
						<content>${response.result}</content>
						<metadata>
							<response_type>text</response_type>
							<response_length>${response.result.length}</response_length>
						</metadata>
					</response>