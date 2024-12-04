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
							<timestamp>${new Date().toISOString()}</timestamp>
						</metadata>
					</response>
				</interaction>
			</consultant_tool_response>`
			return this.toolResponse("success", result)
		} catch (err) {
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "ask_consultant",
						approvalState: "error",
						query: this.params.input.query!,
						error: (err as Error)?.message,
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
					<type>execution_error</type>
					<message>Consultant failed to answer your question</message>
					<context>
						<query>${query}</query>
						<error_message>${(err as Error)?.message || String(err)}</error_message>
						<error_type>execution_failure</error_type>
					</context>
				</error_details>
			</consultant_tool_response>`
			return this.toolResponse("error", errorMsg)
		}
	}

	private async onBadInputReceived() {
		this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "ask_consultant",
					approvalState: "error",
					query: "",
					error: "Missing value for required parameter 'query'.",
					ts: this.ts,
				},
			},
			this.ts
		)
		await this.params.say(
			"error",
			"Claude tried to use `ask_consultant` without required parameter `query`. Retrying..."
		)

		const errorMsg = `
		<consultant_tool_response>
			<status>
				<result>error</result>
				<operation>ask_consultant</operation>
				<timestamp>${new Date().toISOString()}</timestamp>
			</status>
			<error_details>
				<type>missing_parameter</type>
				<message>Missing required parameter 'query'</message>
				<help>
					<example_usage>
						<tool>ask_consultant</tool>
						<parameters>
							<query>I want to build a multiplayer game where 100 players would be playing together at once. What framework should I choose for the backend? I'm confused between Elixir and colyseus</query>
						</parameters>
					</example_usage>
					<note>Consultant queries require a valid query parameter to proceed</note>
				</help>
			</error_details>
		</consultant_tool_response>`
		return this.toolResponse("error", errorMsg)
	}

	private async onExecDenied(confirmation: AskConfirmationResponse) {
		const { response, text, images } = confirmation
		if (response === "messageResponse") {
			// await this.params.say("user_feedback", text, images)
			await this.params.updateAsk(
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
			await this.params.say("user_feedback", text ?? "The user denied this operation.", images)

			return this.toolResponse(
				"feedback",
				`<consultant_tool_response>
					<status>
						<result>feedback</result>
						<operation>ask_consultant</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<feedback_details>
						<query>${this.params.input.query!}</query>
						<user_feedback>${text || "No feedback provided"}</user_feedback>
						${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
					</feedback_details>
				</consultant_tool_response>`,
				images
			)
		}

		return this.toolResponse(
			"rejected",
			`<consultant_tool_response>
				<status>
					<result>rejected</result>
					<operation>ask_consultant</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<rejection_details>
					<query>${this.params.input.query!}</query>
					<message>Operation was rejected by the user</message>
				</rejection_details>
			</consultant_tool_response>`
		)
	}
}
