import { Anthropic } from "@anthropic-ai/sdk"
import { ApiConfiguration, ApiHandler, buildApiHandler } from "../../api"
import { KoduError, koduSSEResponse } from "../../shared/kodu"
import { API_RETRY_DELAY } from "./constants"
import { tools } from "./tools/tools"
import { UserContent } from "./types"
import { amplitudeTracker } from "../../utils/amplitude"
import { truncateHalfConversation } from "../../utils/context-management"
import { SYSTEM_PROMPT, UDIFF_SYSTEM_PROMPT } from "./system-prompt"
import { ClaudeDevProvider } from "../../providers/claude-coder/ClaudeCoderProvider"
import { tools as baseTools, uDifftools } from "./tools/tools"
import { findLast } from "../../utils"
import delay from "delay"

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

	async *createApiStreamRequest(
		apiConversationHistory: Anthropic.MessageParam[],
		abortSignal?: AbortSignal | null
	): AsyncGenerator<koduSSEResponse> {
		const creativeMode = (await this.providerRef.deref()?.getStateManager()?.getState())?.creativeMode ?? "normal"
		let systemPrompt = await SYSTEM_PROMPT()
		let customInstructions: string | undefined
		if (this.customInstructions && this.customInstructions.trim()) {
			customInstructions += `
	  ====
	  
	  USER'S CUSTOM INSTRUCTIONS
	  
	  The following additional instructions are provided by the user. They should be followed and given precedence in case of conflicts with previous instructions.
	  
	  ${this.customInstructions.trim()}
	  `
		}

		try {
			const stream = await this.api.createMessageStream(
				systemPrompt,
				apiConversationHistory,
				tools,
				creativeMode,
				abortSignal,
				customInstructions
			)

			for await (const chunk of stream) {
				switch (chunk.code) {
					case 0:
						console.log("Health check received")
						break
					case 1:
						console.log("finalResponse", chunk)
						// we always reach here
						const response = chunk.body.anthropic
						// update state of credit
						if (chunk.body.internal.userCredits !== undefined) {
							console.log("Updating kodu credits", chunk.body.internal.userCredits)
							this.providerRef
								.deref()
								?.getStateManager()
								?.updateKoduCredits(chunk.body.internal.userCredits)
						}
						const inputTokens = response.usage.input_tokens
						const outputTokens = response.usage.output_tokens
						const cacheCreationInputTokens = (response as any).usage?.cache_creation_input_tokens
						const cacheReadInputTokens = (response as any).usage?.cache_read_input_tokens
						const taskId = (await this.providerRef.deref()?.getState())?.currentTaskId
						const apiCost = this.calculateApiCost(
							inputTokens,
							outputTokens,
							cacheCreationInputTokens,
							cacheReadInputTokens
						)
						amplitudeTracker.taskRequest({
							taskId: taskId!,
							model: this.getModelId(),
							apiCost: apiCost!,
							inputTokens,
							cacheReadTokens: cacheReadInputTokens,
							cacheWriteTokens: cacheCreationInputTokens,
							outputTokens,
						})
						yield chunk
						break
					case 2:
					case 3:
						yield chunk
						break
					case -1:
						console.error("Network / API ERROR")
						throw new KoduError({ code: chunk.body.status ?? 500 })
				}
			}
		} catch (error) {
			if (error instanceof KoduError) {
				console.error("KODU API request failed", error)
			}
			throw error
		}
	}

	async createApiRequest(
		apiConversationHistory: Anthropic.MessageParam[],
		abortSignal?: AbortSignal | null
	): Promise<Anthropic.Messages.Message | Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage> {
		const creativeMode = (await this.providerRef.deref()?.getStateManager()?.getState())?.creativeMode ?? "normal"
		const useUdiff = (await this.providerRef.deref()?.getStateManager()?.getState())?.useUdiff
		let systemPrompt = await SYSTEM_PROMPT()
		let tools = baseTools
		if (useUdiff) {
			systemPrompt = await UDIFF_SYSTEM_PROMPT()
			tools = uDifftools
		}
		let customInstructions: string | undefined
		if (this.customInstructions && this.customInstructions.trim()) {
			customInstructions += `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user. They should be followed and given precedence in case of conflicts with previous instructions.

${this.customInstructions.trim()}
`
		}
		const claudeMessages = (await this.providerRef.deref()?.getStateManager()?.getState())?.claudeMessages
		// If the last API request's total token usage is close to the context window, truncate the conversation history to free up space for the new request
		const lastApiReqFinished = findLast(claudeMessages!, (m) => m.say === "api_req_finished")
		if (lastApiReqFinished && lastApiReqFinished.text) {
			const {
				tokensIn,
				tokensOut,
				cacheWrites,
				cacheReads,
			}: { tokensIn?: number; tokensOut?: number; cacheWrites?: number; cacheReads?: number } = JSON.parse(
				lastApiReqFinished.text
			)
			const totalTokens = (tokensIn || 0) + (tokensOut || 0) + (cacheWrites || 0) + (cacheReads || 0)
			const contextWindow = this.api.getModel().info.contextWindow
			const maxAllowedSize = Math.max(contextWindow - 40_000, contextWindow * 0.8)
			if (totalTokens >= maxAllowedSize) {
				const truncatedMessages = truncateHalfConversation(apiConversationHistory)
				apiConversationHistory = truncatedMessages
				this.providerRef
					.deref()
					?.getKoduDev()
					?.getStateManager()
					.overwriteApiConversationHistory(truncatedMessages)
			}
		}

		try {
			const { message, userCredits } = await this.api.createMessage(
				systemPrompt,
				apiConversationHistory,
				tools,
				creativeMode,
				abortSignal,
				customInstructions
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
