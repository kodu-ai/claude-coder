import assert from "assert"
import { ToolName, ToolResponse } from "../../types"
import { BaseAgentTool } from "../base-agent.tool"
import type { AgentToolOptions, AgentToolParams } from "../types"

export class WebSearchTool extends BaseAgentTool<"web_search"> {
	protected params: AgentToolParams<"web_search">
	private abortController: AbortController

	constructor(params: AgentToolParams<"web_search">, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.abortController = new AbortController()
	}

	async execute() {
		const { say, ask, updateAsk, input } = this.params
		const { searchQuery, baseLink } = input
		const browserMode = input.browserMode ?? "generic"

		if (!searchQuery || !browserMode || !["api_docs", "generic"].includes(browserMode)) {
			return this.onBadInputReceived()
		}

		const { response, text, images } = await ask(
			"tool",
			{
				tool: {
					tool: "web_search",
					searchQuery,
					baseLink,
					browserMode,
					approvalState: "pending",
					ts: this.ts,
				},
			},
			this.ts
		)

		if (response !== "yesButtonTapped") {
			await updateAsk(
				"tool",
				{
					tool: {
						tool: "web_search",
						searchQuery,
						baseLink,
						browserMode,
						approvalState: "rejected",
						ts: this.ts,
						userFeedback: text,
					},
				},
				this.ts
			)
			if (response === "messageResponse") {
				await say("user_feedback", text, images)
				// return this.formatToolResponseWithImages(await this.formatGenericToolFeedback(text), images)
				return this.toolResponse(
					"feedback",
					`<web_search_response>
						<status>
							<result>feedback</result>
							<operation>web_search</operation>
							<timestamp>${new Date().toISOString()}</timestamp>
						</status>
						<feedback_details>
							<query>${searchQuery}</query>
							<browser_mode>${browserMode}</browser_mode>
							${baseLink ? `<base_link>${baseLink}</base_link>` : ""}
							<user_feedback>${text || "No feedback provided"}</user_feedback>
							${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
						</feedback_details>
					</web_search_response>`,
					images
				)
			}
			return this.toolResponse(
				"rejected",
				`<web_search_response>
					<status>
						<result>rejected</result>
						<operation>web_search</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<rejection_details>
						<query>${searchQuery}</query>
						<browser_mode>${browserMode}</browser_mode>
						${baseLink ? `<base_link>${baseLink}</base_link>` : ""}
						<message>Operation was rejected by the user</message>
					</rejection_details>
				</web_search_response>`
			)
		}

		try {
			await updateAsk(
				"tool",
				{
					tool: {
						tool: "web_search",
						searchQuery,
						baseLink,
						browserMode,
						approvalState: "loading",
						ts: this.ts,
					},
				},
				this.ts
			)

			const browserModel = this.koduDev.providerRef
				.deref()
				?.getGlobalStateManager()
				.getGlobalState("browserModelId")
			const api = this.koduDev.getApiManager().getApi()
			const result = await api?.sendWebSearchRequest?.(
				searchQuery,
				baseLink,
				browserModel,
				browserMode,
				this.abortController.signal
			)

			if (!result) {
				throw new Error("Unable to read response")
			}

			let fullContent = ""

			try {
				for await (const chunk of result) {
					if (this.abortController.signal.aborted) {
						throw new Error("Web search aborted")
					}
					await updateAsk(
						"tool",
						{
							tool: {
								tool: "web_search",
								searchQuery,
								baseLink,
								browserMode,
								content: chunk.content,
								streamType: chunk.type,
								approvalState: "loading",
								ts: this.ts,
							},
						},
						this.ts
					)
					fullContent += chunk.content
				}
			} catch (err) {
				if ((err as Error).message === "Web search aborted") {
					await updateAsk(
						"tool",
						{
							tool: {
								tool: "web_search",
								searchQuery,
								browserMode,
								baseLink,
								approvalState: "error",
								error: "Web search was aborted",
								ts: this.ts,
							},
						},
						this.ts
					)
					return this.toolResponse(
						"error",
						`<web_search_response>
							<status>
								<result>error</result>
								<operation>web_search</operation>
								<timestamp>${new Date().toISOString()}</timestamp>
							</status>
							<error_details>
								<type>search_aborted</type>
								<message>Web search was aborted</message>
								<context>
									<query>${searchQuery}</query>
									<browser_mode>${browserMode}</browser_mode>
									${baseLink ? `<base_link>${baseLink}</base_link>` : ""}
								</context>
							</error_details>
						</web_search_response>`
					)
				}
				throw err
			}

			await updateAsk(
				"tool",
				{
					tool: {
						tool: "web_search",
						searchQuery,
						baseLink,
						browserMode,
						approvalState: "approved",
						ts: this.ts,
					},
				},
				this.ts
			)

			return this.toolResponse(
				"success",
				`<web_search_response>
					<status>
						<result>success</result>
						<operation>web_search</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<search_info>
						<query>${searchQuery}</query>
						<browser_mode>${browserMode}</browser_mode>
						${baseLink ? `<base_link>${baseLink}</base_link>` : ""}
						${browserModel ? `<browser_model>${browserModel}</browser_model>` : ""}
					</search_info>
					<search_results>
						<content>${fullContent}</content>
					</search_results>
				</web_search_response>`
			)
		} catch (err) {
			await updateAsk(
				"tool",
				{
					tool: {
						tool: "web_search",
						browserMode,
						searchQuery: searchQuery ?? "",
						baseLink: baseLink ?? "",
						approvalState: "error",
						error: `${err}`,
						ts: this.ts,
					},
				},
				this.ts
			)
			return this.toolResponse(
				"error",
				`<web_search_response>
					<status>
						<result>error</result>
						<operation>web_search</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<error_details>
						<type>search_failed</type>
						<message>Web search failed</message>
						<context>
							<query>${searchQuery}</query>
							<browser_mode>${browserMode}</browser_mode>
							${baseLink ? `<base_link>${baseLink}</base_link>` : ""}
							<error_message>${err}</error_message>
						</context>
					</error_details>
				</web_search_response>`
			)
		}
	}

	private async onBadInputReceived() {
		const { searchQuery, browserMode } = this.params.input
		await this.params.say(
			"error",
			"Claude tried to use `web_search` without required parameter `searchQuery` or `browserMode`. Retrying..."
		)

		const errorMsg = `
		<web_search_response>
			<status>
				<result>error</result>
				<operation>web_search</operation>
				<timestamp>${new Date().toISOString()}</timestamp>
			</status>
			<error_details>
				<type>missing_parameters</type>
				<message>Missing required parameters 'searchQuery' or 'browserMode'</message>
				<validation>
					<searchQuery_provided>${!!searchQuery}</searchQuery_provided>
					<browserMode_provided>${!!browserMode}</browserMode_provided>
					<browserMode_valid>${["api_docs", "generic"].includes(browserMode || "")}</browserMode_valid>
				</validation>
				<help>
					<example_usage>
						<tool>web_search</tool>
						<parameters>
							<searchQuery>How to import jotai in a react project</searchQuery>
							<baseLink>https://jotai.org/docs/introduction</baseLink>
							<browserMode>api_docs</browserMode>
						</parameters>
					</example_usage>
					<note>Both searchQuery and a valid browserMode are required for web searches</note>
				</help>
			</error_details>
		</web_search_response>`
		return this.toolResponse("error", errorMsg)
	}

	public override abortToolExecution(): Promise<void> {
		// super.abortToolExecution()
		this.abortController.abort()
		return Promise.resolve()
	}
}
