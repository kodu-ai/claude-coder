import assert from "assert"
import { ToolName, ToolResponse } from "../../types"
import { BaseAgentTool } from "../base-agent.tool"
import type { AgentToolOptions, AgentToolParams } from "../types"

export class WebSearchTool extends BaseAgentTool {
	protected params: AgentToolParams
	private abortController: AbortController

	constructor(params: AgentToolParams, options: AgentToolOptions) {
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
				return this.toolResponse("feedback", text, images)
			}
			return this.toolResponse("rejected", "The user denied this operation.")
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
					return this.toolResponse("error", "Web search was aborted")
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

			return this.toolResponse("success", fullContent)
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
			return this.toolResponse("error", `Web search failed with error: ${err}`)
		}
	}

	private async onBadInputReceived() {
		await this.params.say(
			"error",
			"Claude tried to use `web_search` without required parameter `searchQuery` or `browserMode`. Retrying..."
		)

		const errorMsg = `Error: Missing value for required parameter 'searchQuery' or 'browserMode'. Please retry with complete response.
			A good example of a web_search tool call is:
			{
				"tool": "web_search",
				"searchQuery": "How to import jotai in a react project",
				"baseLink": "https://jotai.org/docs/introduction",
				"browserMode": "api_docs",
				"browserModel": "smart"
			}
			Please try again with the correct searchQuery, you are not allowed to search without a searchQuery.`
		return this.toolResponse("error", errorMsg)
	}

	public override abortToolExecution(): Promise<void> {
		// super.abortToolExecution()
		this.abortController.abort()
		return Promise.resolve()
	}
}
