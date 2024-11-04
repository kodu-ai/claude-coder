/**
 * @fileoverview API Manager for handling Claude API interactions
 * This module manages API communications with the Anthropic Claude API, handling message streams,
 * token calculations, and conversation history management.
 */

import Anthropic from "@anthropic-ai/sdk"
import { AxiosError } from "axios"
import { findLast } from "lodash"
import { ApiHandler, ApiConfiguration, buildApiHandler } from "../../api"
import { ExtensionProvider } from "../../providers/claude-coder/ClaudeCoderProvider"
import { koduModels } from "../../shared/api"
import { isV1ClaudeMessage, V1ClaudeMessage } from "../../shared/ExtensionMessage"
import { koduSSEResponse, KoduError } from "../../shared/kodu"
import { amplitudeTracker } from "../../utils/amplitude"
import { estimateTokenCount, smartTruncation, truncateHalfConversation } from "../../utils/context-management"
import { BASE_SYSTEM_PROMPT, criticalMsg } from "./prompts/base-system"
import { ClaudeMessage, UserContent } from "./types"
import { getCwd, isTextBlock } from "./utils"

/**
 * Interface for tracking API usage metrics
 */
interface ApiMetrics {
	inputTokens: number
	outputTokens: number
	inputCacheRead: number
	inputCacheWrite: number
	cost: number
}

/**
 * Interface for tracking differences between strings
 */
interface StringDifference {
	index: number
	char1: string
	char2: string
}

/**
 * Compares two strings and finds all character differences
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Array of differences with their positions
 */
export function findStringDifferences(str1: string, str2: string): StringDifference[] {
	const differences: StringDifference[] = []
	const maxLength = Math.max(str1.length, str2.length)
	const paddedStr1 = str1.padEnd(maxLength)
	const paddedStr2 = str2.padEnd(maxLength)

	for (let i = 0; i < maxLength; i++) {
		if (paddedStr1[i] !== paddedStr2[i]) {
			differences.push({
				index: i,
				char1: paddedStr1[i],
				char2: paddedStr2[i],
			})
		}
	}

	return differences
}

/**
 * Main API Manager class that handles all Claude API interactions
 */
export class ApiManager {
	private api: ApiHandler
	private customInstructions?: string
	private providerRef: WeakRef<ExtensionProvider>

	constructor(provider: ExtensionProvider, apiConfiguration: ApiConfiguration, customInstructions?: string) {
		this.api = buildApiHandler(apiConfiguration)
		this.customInstructions = customInstructions
		this.providerRef = new WeakRef(provider)
	}

	/**
	 * Returns the current API handler instance
	 */
	public getApi(): ApiHandler {
		return this.api
	}

	/**
	 * Returns the current model ID
	 */
	public getModelId(): string {
		return this.api.getModel().id
	}

	public getModelInfo() {
		return this.api.getModel().info
	}

	/**
	 * Aborts the current API request
	 */
	public abortRequest(): void {
		this.api.abortRequest()
	}

	/**
	 * Updates the API configuration
	 * @param apiConfiguration - New API configuration
	 */
	public updateApi(apiConfiguration: ApiConfiguration): void {
		this.log("info", "Updating API configuration", apiConfiguration)
		this.api = buildApiHandler(apiConfiguration)
	}

	/**
	 * Updates custom instructions for the API
	 * @param customInstructions - New custom instructions
	 */
	public updateCustomInstructions(customInstructions: string | undefined): void {
		this.customInstructions = customInstructions
	}

	/**
	 * Formats custom instructions with proper sectioning
	 * @returns Formatted custom instructions string
	 */
	private formatCustomInstructions(): string | undefined {
		if (!this.customInstructions?.trim()) {
			return undefined
		}

		return `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user. They should be followed and given precedence in case of conflicts with previous instructions.

${this.customInstructions.trim()}
`
	}

	/**
	 * Retrieves and processes API metrics from conversation history
	 * @param claudeMessages - Conversation history
	 * @returns Processed API metrics
	 */
	private getApiMetrics(claudeMessages: ClaudeMessage[]): ApiMetrics {
		const defaultMetrics: ApiMetrics = {
			inputTokens: 0,
			outputTokens: 0,
			inputCacheRead: 0,
			inputCacheWrite: 0,
			cost: 0,
		}

		const lastApiReqFinished = findLast(claudeMessages, (m) => m.say === "api_req_finished")
		if (lastApiReqFinished?.text) {
			const { tokensIn, tokensOut, cacheWrites, cacheReads } = JSON.parse(lastApiReqFinished.text)
			return {
				inputTokens: tokensIn || 0,
				outputTokens: tokensOut || 0,
				inputCacheRead: cacheReads || 0,
				inputCacheWrite: cacheWrites || 0,
				cost: 0,
			}
		}

		const reversedMessages = claudeMessages.slice().reverse()
		const lastV1Message = reversedMessages.find((m) => isV1ClaudeMessage(m) && m?.apiMetrics)
		return (lastV1Message as V1ClaudeMessage)?.apiMetrics || defaultMetrics
	}

	/**
	 * Creates a streaming API request
	 * @param apiConversationHistory - Conversation history
	 * @param abortSignal - Optional abort signal for cancelling requests
	 * @returns AsyncGenerator yielding SSE responses
	 */
	async *createApiStreamRequest(
		apiConversationHistory: Anthropic.MessageParam[],
		abortSignal?: AbortSignal | null,
		abortController?: AbortController
	): AsyncGenerator<koduSSEResponse> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference has been garbage collected")
		}

		const state = await provider.getStateManager()?.getState()
		const creativeMode = state?.creativeMode ?? "normal"
		const technicalBackground = state?.technicalBackground ?? "no-technical"
		const isImageSupported = koduModels[this.getModelId()].supportsImages
		const systemPromptVariants = state?.systemPromptVariants || []
		const activeVariantId = state?.activeSystemPromptVariantId
		const activeVariant = systemPromptVariants.find((variant) => variant.id === activeVariantId)
		const customInstructions = this.formatCustomInstructions()
		let systemPrompt = ""

		if (activeVariant) {
			systemPrompt = activeVariant.content
		} else {
			systemPrompt = await BASE_SYSTEM_PROMPT(getCwd(), isImageSupported, technicalBackground)
		}

		// Process conversation history and manage context window
		await this.processConversationHistory(apiConversationHistory)

		let apiConversationHistoryCopy = apiConversationHistory.slice()
		// remove the last message from it if it's assistant's message (it should be, because we add it before calling this function)
		// this lets us always keep a pair of user and assistant messages in the history no matter what
		if (apiConversationHistoryCopy[apiConversationHistoryCopy.length - 1].role === "assistant") {
			apiConversationHistoryCopy = apiConversationHistoryCopy.slice(0, apiConversationHistoryCopy.length - 1)
		}

		let lastMessageAt = 0
		const TIMEOUT_MS = 5000 // 5 seconds
		const checkInactivity = setInterval(() => {
			const timeSinceLastMessage = Date.now() - lastMessageAt
			if (lastMessageAt > 0 && timeSinceLastMessage > TIMEOUT_MS) {
				abortController?.abort()
				return
			}
		}, 1000)

		try {
			// Update the UI with the request running state
			this.providerRef.deref()?.getWebviewManager().postMessageToWebview({
				type: "requestStatus",
				isRunning: true,
			})

			// log the last 2 messages
			this.log("info", `Last 2 messages:`, apiConversationHistoryCopy.slice(-2))

			const stream = await this.api.createMessageStream(
				systemPrompt.trim(),
				apiConversationHistoryCopy,
				creativeMode,
				abortSignal,
				customInstructions
			)

			for await (const chunk of stream) {
				if (chunk.code === 1 || chunk.code === -1) {
					clearInterval(checkInactivity)
				}
				lastMessageAt = Date.now()
				yield* this.processStreamChunk(chunk)
			}
		} catch (error) {
			if (error instanceof Error && error.message === "aborted") {
				// this is an abort error
				error = new KoduError({
					code: 1,
				})
			}
			if (error instanceof AxiosError) {
				// this is a timeout error
				error = new KoduError({
					code: 1,
				})
			}
			this.handleStreamError(error)
		} finally {
			// Update the UI with the request running state
			this.providerRef.deref()?.getWebviewManager().postMessageToWebview({
				type: "requestStatus",
				isRunning: false,
			})
			clearInterval(checkInactivity)
		}
	}

	/**
	 * Processes the conversation history and manages context window
	 * @param history - Conversation history to process
	 */
	private async processConversationHistory(history: Anthropic.MessageParam[]): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			return
		}

		const lastMessage = history[history.length - 2]
		const isLastMessageFromUser = lastMessage?.role === "user"

		// Convert string content to structured content if needed
		if (typeof lastMessage?.content === "string") {
			lastMessage.content = [
				{
					type: "text",
					text: lastMessage.content,
				},
			]
		}

		// Add environment details and critical messages if needed
		await this.enrichConversationHistory(history, isLastMessageFromUser)

		// Manage context window
		await this.manageContextWindow(history)
	}

	/**
	 * Enriches conversation history with environment details and critical messages
	 * @param history - Conversation history to enrich
	 * @param isLastMessageFromUser - Whether the last message was from the user
	 */
	private async enrichConversationHistory(
		history: Anthropic.MessageParam[],
		isLastMessageFromUser: boolean
	): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			return
		}

		// Add critical messages every 4th message or the first message
		const shouldAddCriticalMsg = (history.length % 8 === 0 && history.length > 8) || history.length === 2

		const lastMessage = history[history.length - 2]

		const shouldAppendCriticalMsg =
			(await this.providerRef.deref()?.getState())?.activeSystemPromptVariantId === "m-11-1-2024"

		if (
			shouldAddCriticalMsg &&
			isLastMessageFromUser &&
			Array.isArray(lastMessage.content) &&
			shouldAppendCriticalMsg
		) {
			lastMessage.content.push({
				type: "text",
				text: criticalMsg,
			})
		}

		const isFirstRequest = provider.getKoduDev()?.isFirstMessage ?? false
		const environmentDetails = await provider.getKoduDev()?.getEnvironmentDetails(isFirstRequest)

		if (Array.isArray(lastMessage.content) && environmentDetails && isLastMessageFromUser) {
			const hasEnvDetails = lastMessage.content.some(
				(block) =>
					isTextBlock(block) &&
					block.text.includes("<environment_details>") &&
					block.text.includes("</environment_details>")
			)

			if (!hasEnvDetails) {
				lastMessage.content.push({
					type: "text",
					text: environmentDetails,
				})
			}
		}
	}

	/**
	 * Manages the context window to prevent token overflow
	 * @param history - Conversation history to manage
	 */
	private async manageContextWindow(history: Anthropic.MessageParam[]): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			return
		}

		const state = await provider.getStateManager()?.getState()
		const metrics = this.getApiMetrics(state?.claudeMessages || [])
		const totalTokens =
			metrics.inputTokens +
			metrics.outputTokens +
			metrics.inputCacheWrite +
			metrics.inputCacheRead +
			estimateTokenCount(history[history.length - 1])

		const contextWindow = this.api.getModel().info.contextWindow

		// if (totalTokens >= contextWindow * 0.75) {
		/// this we should actually get from the AI itself
		if (totalTokens >= 0.75 * contextWindow) {
			const truncatedMessages = smartTruncation(history)
			const newMemorySize = truncatedMessages.reduce((acc, message) => acc + estimateTokenCount(message), 0)
			this.log("info", `API History before truncation:`, history)
			this.log("info", `Truncated messages:`, truncatedMessages)
			this.log("info", `Total tokens before truncation: ${totalTokens}`)
			this.log("info", `Total tokens after truncation: ${newMemorySize}`)

			// if this condition hit the task should be blocked
			if (newMemorySize >= contextWindow * 0.75) {
				// we reached the end
				await provider.getKoduDev()?.getStateManager().overwriteApiConversationHistory(truncatedMessages)
				this.providerRef
					.deref()
					?.getKoduDev()
					?.taskExecutor.say(
						"chat_finished",
						`The chat has reached the maximum token limit. Please create a new task to continue.`
					)
				return
			}
			await provider.getKoduDev()?.getStateManager().overwriteApiConversationHistory(truncatedMessages)
			await this.providerRef
				.deref()
				?.getKoduDev()
				?.taskExecutor.say("chat_truncated", `The conversation has been truncated to prevent token overflow`)
		}
	}

	/**
	 * Processes stream chunks from the API response
	 * @param chunk - SSE response chunk
	 */
	private async *processStreamChunk(chunk: koduSSEResponse): AsyncGenerator<koduSSEResponse> {
		switch (chunk.code) {
			case 0:
				break
			case 1:
				await this.handleFinalResponse(chunk)
				break
		}
		yield chunk
	}

	/**
	 * Handles the final response from the API
	 * @param chunk - Final response chunk
	 */
	private async handleFinalResponse(chunk: koduSSEResponse): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			return
		}
		if (chunk.code !== 1) {
			return
		}
		const response = chunk?.body?.anthropic
		const { input_tokens, output_tokens } = response.usage
		const { cache_creation_input_tokens, cache_read_input_tokens } = response.usage as any

		// Update credits if provided
		if (chunk.body.internal.userCredits !== undefined) {
			await provider.getStateManager()?.updateKoduCredits(chunk.body.internal.userCredits)
		}

		// Track metrics
		const state = await provider.getState()
		const apiCost = this.calculateApiCost(
			input_tokens,
			output_tokens,
			cache_creation_input_tokens,
			cache_read_input_tokens
		)
		this.log("info", `API REQUEST FINISHED: ${apiCost} tokens used data:`, response)

		amplitudeTracker.taskRequest({
			taskId: state?.currentTaskId!,
			model: this.getModelId(),
			apiCost: apiCost,
			inputTokens: input_tokens,
			cacheReadTokens: cache_read_input_tokens,
			cacheWriteTokens: cache_creation_input_tokens,
			outputTokens: output_tokens,
		})
	}

	/**
	 * Handles stream errors
	 * @param error - Error from the stream
	 */
	private handleStreamError(error: unknown): never {
		if (error instanceof KoduError) {
			console.error("KODU API request failed", error)
			throw error
		}

		if (error instanceof AxiosError) {
			throw new KoduError({
				code: error.response?.status || 500,
			})
		}

		throw error
	}

	/**
	 * Creates a human-readable request string
	 * @param userContent - User content to format
	 * @returns Formatted request string
	 */
	public createUserReadableRequest(userContent: UserContent): string {
		return this.api.createUserReadableRequest(userContent)
	}

	/**
	 * Calculates the API cost based on token usage
	 * @param inputTokens - Number of input tokens
	 * @param outputTokens - Number of output tokens
	 * @param cacheCreationInputTokens - Number of cache creation tokens
	 * @param cacheReadInputTokens - Number of cache read tokens
	 * @returns Total API cost
	 */
	public calculateApiCost(
		inputTokens: number,
		outputTokens: number,
		cacheCreationInputTokens?: number,
		cacheReadInputTokens?: number
	): number {
		const model = this.api.getModel().info
		const cacheWritesCost =
			cacheCreationInputTokens && model.cacheWritesPrice
				? (model.cacheWritesPrice / 1_000_000) * cacheCreationInputTokens
				: 0

		const cacheReadsCost =
			cacheReadInputTokens && model.cacheReadsPrice
				? (model.cacheReadsPrice / 1_000_000) * cacheReadInputTokens
				: 0

		const baseInputCost = (model.inputPrice / 1_000_000) * inputTokens
		const outputCost = (model.outputPrice / 1_000_000) * outputTokens

		return cacheWritesCost + cacheReadsCost + baseInputCost + outputCost
	}

	private log(status: "info" | "debug" | "error", message: string, ...args: any[]) {
		console[status](`[API Manager] ${message}`, ...args)
	}
}
