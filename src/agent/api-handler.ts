import { Anthropic } from "@anthropic-ai/sdk"
import { ApiConfiguration, ApiHandler, buildApiHandler } from "../api"
import { UserContent } from "./types"
import { API_RETRY_DELAY } from "./constants"
import { serializeError } from "serialize-error"
import { truncateHalfConversation } from "../utils/context-management"
import { SYSTEM_PROMPT } from "./system-prompt"
import { tools } from "./tools"
import { ClaudeDevProvider } from "../providers/ClaudeDevProvider"
import { KoduError } from "../shared/kodu"

export class ApiManager {
	private api: ApiHandler
	private customInstructions?: string
	private providerRef: WeakRef<ClaudeDevProvider>

	constructor(provider: ClaudeDevProvider, apiConfiguration: ApiConfiguration, customInstructions?: string) {
		this.api = buildApiHandler(apiConfiguration)
		this.customInstructions = customInstructions
		this.providerRef = new WeakRef(provider)
	}

	abortRequest(): void {
		this.api.abortRequest()
	}

	updateApi(apiConfiguration: ApiConfiguration): void {
		this.api = buildApiHandler(apiConfiguration)
	}

	updateCustomInstructions(customInstructions: string | undefined): void {
		this.customInstructions = customInstructions
	}

	async createApiRequest(
		apiConversationHistory: Anthropic.MessageParam[]
	): Promise<Anthropic.Messages.Message | Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage> {
		const creativeMode = (await this.providerRef.deref()?.getState())?.creativeMode ?? "normal"
		let systemPrompt = await SYSTEM_PROMPT()
		if (this.customInstructions && this.customInstructions.trim()) {
			systemPrompt += `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user. They should be followed and given precedence in case of conflicts with previous instructions.

${this.customInstructions.trim()}
`
		}

		try {
			const { message, userCredits } = await this.api.createMessage(
				systemPrompt,
				apiConversationHistory,
				tools,
				creativeMode
			)

			if (userCredits !== undefined) {
				console.log("Updating kodu credits", userCredits)
				this.providerRef.deref()?.updateKoduCredits(userCredits)
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
