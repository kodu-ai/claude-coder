import { Anthropic } from "@anthropic-ai/sdk"
import { ApiConfiguration, ApiHandler, buildApiHandler } from "../../api"
import { UserContent } from "./types"
import { API_RETRY_DELAY } from "./constants"
import { serializeError } from "serialize-error"
import { truncateHalfConversation } from "../../utils/context-management"
import { SYSTEM_PROMPT } from "./system-prompt"
import { ClaudeDevProvider } from "../../providers/claude-dev/ClaudeDevProvider"
import { KoduError } from "../../shared/kodu"
import { tools } from "./tools/tools"

export class ApiManager {
	private api: ApiHandler
	private customInstructions?: string
	private providerRef: WeakRef<ClaudeDevProvider>

	constructor(provider: ClaudeDevProvider, apiConfiguration: ApiConfiguration, customInstructions?: string) {
		this.api = buildApiHandler(apiConfiguration)
		this.customInstructions = customInstructions
		this.providerRef = new WeakRef(provider)
	}

	public getApi(): ApiHandler {
		return this.api
	}

	public getModelId() {
		return this.api.getModel().id
	}

	abortRequest(): void {
		this.api.abortRequest()
	}

	updateApi(apiConfiguration: ApiConfiguration): void {
		console.log("Updating API configuration", apiConfiguration)
		this.api = buildApiHandler(apiConfiguration)
	}

	updateCustomInstructions(customInstructions: string | undefined): void {
		this.customInstructions = customInstructions
	}

	async createApiRequest(
		apiConversationHistory: Anthropic.MessageParam[],
		abortSignal?: AbortSignal | null
	): Promise<Anthropic.Messages.Message | Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage> {
		const creativeMode = (await this.providerRef.deref()?.getStateManager()?.getState())?.creativeMode ?? "normal"
		let systemPrompt = await SYSTEM_PROMPT()
		if (this.customInstructions && this.customInstructions.trim()) {
			systemPrompt += `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user. They should be followed and given precedence in case of conflicts with previous instructions.

${this.customInstructions.trim()}
`
		}
		// console.log(`Original conversation history:`, apiConversationHistory)
		const adjustedHistory = await this.adjustContextWindow(apiConversationHistory)
		// console.log("Adjusted conversation history", adjustedHistory)

		try {
			const { message, userCredits } = await this.api.createMessage(
				systemPrompt,
				adjustedHistory,
				tools,
				creativeMode,
				abortSignal
			)

			if (userCredits !== undefined) {
				console.log("Updating kodu credits", userCredits)
				this.providerRef.deref()?.getStateManager()?.updateKoduCredits(userCredits)
			}

			return message
		} catch (error) {
			if (error instanceof KoduError) {
				console.error("KODU API request failed", error)
			}
			throw error
		}
	}

	async retryApiRequest(apiConversationHistory: Anthropic.MessageParam[]): Promise<Anthropic.Messages.Message> {
		await new Promise((resolve) => setTimeout(resolve, API_RETRY_DELAY))
		return this.createApiRequest(apiConversationHistory)
	}

	createUserReadableRequest(userContent: UserContent): string {
		return this.api.createUserReadableRequest(userContent)
	}

	async adjustContextWindow(apiConversationHistory: Anthropic.MessageParam[]): Promise<Anthropic.MessageParam[]> {
		const contextWindow = this.api.getModel().info.contextWindow
		const maxAllowedSize = Math.floor(contextWindow * 0.85) // Leave 15% buffer for safety

		if (apiConversationHistory.length <= 3) {
			return apiConversationHistory // Return as is if there are 3 or fewer messages
		}

		let adjustedHistory: Anthropic.MessageParam[] = []
		let currentSize = 0

		// Always include the first system message and the first user-assistant pair
		adjustedHistory.push(apiConversationHistory[0]) // System message
		adjustedHistory.push(apiConversationHistory[1]) // First user message
		adjustedHistory.push(apiConversationHistory[2]) // First assistant message

		// Calculate the size of the initial messages
		currentSize = this.calculateMessageSize(adjustedHistory)

		// Process the remaining messages in reverse order (most recent first)
		for (let i = apiConversationHistory.length - 1; i > 2; i -= 2) {
			const assistantMessage = apiConversationHistory[i]
			const userMessage = apiConversationHistory[i - 1]

			const pairSize = this.calculateMessageSize([userMessage, assistantMessage])

			if (currentSize + pairSize <= maxAllowedSize) {
				adjustedHistory.unshift(assistantMessage)
				adjustedHistory.unshift(userMessage)
				currentSize += pairSize
			} else {
				break // Stop adding messages if we exceed the max allowed size
			}
		}

		return adjustedHistory
	}

	private calculateMessageSize(messages: Anthropic.MessageParam[]): number {
		return messages.reduce((total, message) => {
			if (typeof message.content === "string") {
				return total + this.estimateTokens(message.content)
			} else if (Array.isArray(message.content)) {
				return (
					total +
					message.content.reduce((contentTotal, contentItem) => {
						if (contentItem.type === "text") {
							return contentTotal + this.estimateTokens(contentItem.text)
						} else if (contentItem.type === "image") {
							// Assume a fixed token cost for images, e.g., 1028 tokens (on usual it's around 1000 tokens)
							contentItem.source.data
							return contentTotal + 1028
						} else if (contentItem.type === "tool_use") {
							return contentTotal + this.calculateToolUseBlockSize(contentItem)
						} else if (contentItem.type === "tool_result") {
							return contentTotal + this.calculateToolResultBlockSize(contentItem)
						}
						return contentTotal
					}, 0)
				)
			}
			return total
		}, 0)
	}

	private calculateToolUseBlockSize(toolUseBlock: Anthropic.ToolUseBlockParam): number {
		let size = this.estimateTokens(toolUseBlock.name)
		size += this.estimateTokens(toolUseBlock.id)
		size += this.estimateTokens(JSON.stringify(toolUseBlock.input))
		return size
	}

	private calculateToolResultBlockSize(toolResultBlock: Anthropic.ToolResultBlockParam): number {
		let size = this.estimateTokens(toolResultBlock.tool_use_id)
		if (typeof toolResultBlock.content === "string") {
			size += this.estimateTokens(toolResultBlock.content)
		} else if (Array.isArray(toolResultBlock.content)) {
			size += toolResultBlock.content.reduce((contentTotal, contentItem) => {
				if (contentItem.type === "text") {
					return contentTotal + this.estimateTokens(contentItem.text)
				} else if (contentItem.type === "image") {
					// Assume a fixed token cost for images, e.g., 100 tokens
					return contentTotal + 100
				}
				return contentTotal
			}, 0)
		}
		return size
	}

	/**
	 * @description Estimates the number of tokens required to process the given text.
	 * Currently there is no publicy available tokenization algorithm, so we use a simple heuristic 3.5 characters per token.
	 */
	private estimateTokens(text: string): number {
		return Math.ceil(text.length / 3.5)
	}

	calculateApiCost(
		inputTokens: number,
		outputTokens: number,
		cacheCreationInputTokens?: number,
		cacheReadInputTokens?: number
	): number {
		const modelCacheWritesPrice = this.api.getModel().info.cacheWritesPrice
		let cacheWritesCost = 0
		if (cacheCreationInputTokens && modelCacheWritesPrice) {
			cacheWritesCost = (modelCacheWritesPrice / 1_000_000) * cacheCreationInputTokens
		}
		const modelCacheReadsPrice = this.api.getModel().info.cacheReadsPrice
		let cacheReadsCost = 0
		if (cacheReadInputTokens && modelCacheReadsPrice) {
			cacheReadsCost = (modelCacheReadsPrice / 1_000_000) * cacheReadInputTokens
		}
		const baseInputCost = (this.api.getModel().info.inputPrice / 1_000_000) * inputTokens
		const outputCost = (this.api.getModel().info.outputPrice / 1_000_000) * outputTokens
		const totalCost = cacheWritesCost + cacheReadsCost + baseInputCost + outputCost
		return totalCost
	}
}
