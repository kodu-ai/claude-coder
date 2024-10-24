import Anthropic from '@anthropic-ai/sdk'
import { ToolResponse } from '../../types'
import { formatGenericToolFeedback, formatToolResponse } from '../../utils'
import { BaseAgentTool } from '../base-agent.tool'
import type { AgentToolOptions, AgentToolParams, AskConfirmationResponse } from '../types'

export class WebSearchTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { say, updateAsk, input } = this.params
		const { searchQuery, baseLink } = input

		if (!searchQuery) {
			await say('error', 'Claude tried to use `web_search` without required parameters. Retrying...')
			return `Error: Missing value for required parameters. Please retry with complete response.
				A good example of a web_search tool call is:
				{
					"tool": "web_search",
					"searchQuery": "How to import jotai in a react project",
					"baseLink": "https://jotai.org/docs/introduction"
				}
				Please try again with the correct parameters.`
		}

		const confirmation = await this.askToolExecConfirmation(searchQuery, baseLink || '')
		if (confirmation.response !== 'yesButtonTapped') {
			await updateAsk(
				'tool',
				{
					tool: {
						tool: 'web_search',
						searchQuery,
						baseLink,
						approvalState: 'rejected',
						ts: this.ts,
					},
				},
				this.ts,
			)
			return await this.onExecDenied(confirmation)
		}

		try {
			await updateAsk(
				'tool',
				{
					tool: {
						tool: 'web_search',
						searchQuery,
						baseLink,
						approvalState: 'loading',
						ts: this.ts,
					},
				},
				this.ts,
			)

			let textBlock: Anthropic.TextBlockParam

			if (baseLink) {
				const browserManager = this.koduDev.browserManager
				await browserManager.launchBrowser()

				const { content } = await browserManager.getWebsiteContent(baseLink)

				await browserManager.closeBrowser()

				textBlock = {
					type: 'text',
					text: `Page crawl results for: ${baseLink}\nPage content: ${content}`,
				}
			} else {
				const result = await this.koduDev
					.getApiManager()
					.getApi()
					?.sendWebSearchRequest?.(searchQuery, baseLink)
					.then((res) => res)
					.catch((err) => undefined)
				if (!result) {
					updateAsk(
						'tool',
						{
							tool: {
								tool: 'web_search',
								searchQuery,
								baseLink,
								approvalState: 'error',
								error: 'No result found.',
								ts: this.ts,
							},
						},
						this.ts,
					)
					return 'Web search failed with error: No result found.'
				}

				textBlock = {
					type: 'text',
					text: result.content,
				}
			}

			// Done with the tool execution (backend call / browser)
			await updateAsk(
				'tool',
				{
					tool: {
						tool: 'web_search',
						searchQuery,
						baseLink,
						approvalState: 'approved',
						ts: this.ts,
					},
				},
				this.ts,
			)
			return formatToolResponse(textBlock.text)
		} catch (err) {
			await updateAsk(
				'tool',
				{
					tool: {
						tool: 'web_search',
						searchQuery,
						baseLink,
						approvalState: 'error',
						error: `Web search failed with error: ${err}`,
						ts: this.ts,
					},
				},
				this.ts,
			)
			return `Web search failed with error: ${err}`
		}
	}

	private async askToolExecConfirmation(searchQuery: string, baseLink: string): Promise<AskConfirmationResponse> {
		return await this.params.ask(
			'tool',
			{
				tool: {
					tool: 'web_search',
					searchQuery: searchQuery,
					baseLink: baseLink,
					approvalState: 'pending',
					ts: this.ts,
				},
			},
			this.ts,
		)
	}

	private async onExecDenied(confirmation: AskConfirmationResponse) {
		const { response, text, images } = confirmation

		if (response === 'messageResponse') {
			await this.params.say('user_feedback', text, images)
			return formatToolResponse(formatGenericToolFeedback(text), images)
		}

		return 'The user denied this operation.'
	}
}
