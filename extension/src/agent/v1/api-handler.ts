/**
 * @fileoverview API Manager for handling Claude API interactions
 * This module manages API communications with the Anthropic Claude API, handling message streams,
 * token calculations, and conversation history management.
 */

import Anthropic from "@anthropic-ai/sdk"
import { AxiosError } from "axios"
import { findLast } from "lodash"
import { ApiConfiguration, ApiHandler, buildApiHandler } from "../../api"
import { ExtensionProvider } from "../../providers/claude-coder/claude-coder-provider"
import { isV1ClaudeMessage, V1ClaudeMessage } from "../../shared/extension-message"
import { KoduError, koduSSEResponse } from "../../shared/kodu"
import { amplitudeTracker } from "../../utils/amplitude"
import { estimateTokenCount, smartTruncation, truncateHalfConversation } from "../../utils/context-managment"
import { ApiHistoryItem, ClaudeMessage, UserContent } from "./types"
import { getCwd, isTextBlock } from "./utils"
import m11182024Prompt from "./prompts/main.prompt"

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
 * Main API Manager class that handles all Claude API interactions
 */
export class ApiManager {
	private api: ApiHandler
	private customInstructions?: string
	private providerRef: WeakRef<ExtensionProvider>
	private currentSystemPrompt = ""

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

	public async fixUdiff(udiff: string, fileContent: string, relPath: string) {
		return this.api.fixUdiff(udiff, fileContent, relPath)
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
		apiConversationHistory: ApiHistoryItem[],
		abortController: AbortController
	): AsyncGenerator<koduSSEResponse> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference has been garbage collected")
		}

		const executeRequest = async () => {
			const conversationHistory =
				provider.koduDev?.getStateManager().state.apiConversationHistory || apiConversationHistory
			// Process conversation history and manage context window
			await this.processConversationHistory(conversationHistory)

			let apiConversationHistoryCopy = conversationHistory.slice()
			// remove the last message from it if it's assistant's message
			if (apiConversationHistoryCopy[apiConversationHistoryCopy.length - 1].role === "assistant") {
				apiConversationHistoryCopy = apiConversationHistoryCopy.slice(0, apiConversationHistoryCopy.length - 1)
			}
			// check if the last message text is EMPTY STRING and no other content is so we are going to pop it.
			const lastMessage = apiConversationHistoryCopy[apiConversationHistoryCopy.length - 1]
			if (
				Array.isArray(lastMessage.content) &&
				lastMessage.content.length === 1 &&
				lastMessage.content[0].type === "text" &&
				lastMessage.content[0].text.trim() === ""
			) {
				this.log(
					"error",
					`Last Message is empty string, removing it from the history | ROLE: ${lastMessage.role}`
				)
				apiConversationHistoryCopy = apiConversationHistoryCopy.slice(0, apiConversationHistoryCopy.length - 1)
			}
			// log the last 2 messages
			this.log("info", `Last 2 messages:`, apiConversationHistoryCopy.slice(-2))
			const supportImages = this.api.getModel().info.supportsImages
			const supportComputerUse = supportImages && this.getModelId().includes("sonnet")
			const baseSystem = m11182024Prompt.prompt(getCwd(), supportImages, supportComputerUse)
			const systemPrompt = [baseSystem]
			const customInstructions = this.formatCustomInstructions()
			if (customInstructions) {
				systemPrompt.push(customInstructions)
			}
			const stream = await this.api.createMessageStream({
				systemPrompt,
				messages: apiConversationHistoryCopy,
				modelId: this.getModelId(),
				abortSignal: abortController.signal,
			})

			return stream
		}

		let lastMessageAt = 0
		const TIMEOUT_MS = 10_000 // 10 seconds
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

			let retryAttempt = 0
			const MAX_RETRIES = 5

			while (retryAttempt <= MAX_RETRIES) {
				try {
					const stream = await executeRequest()

					for await (const chunk of stream) {
						if (chunk.code === 1) {
							clearInterval(checkInactivity)
							yield* this.processStreamChunk(chunk)
							// will this return return otuside the loop? or outside of the function?
							return
						}

						if (chunk.code === -1 && chunk.body.msg?.includes("prompt is too long")) {
							// clear the interval
							clearInterval(checkInactivity)
							// Compress the context and retry
							const result = await this.manageContextWindow()
							if (result === "chat_finished") {
								// if the chat is finsihed, throw an error
								throw new KoduError({ code: 413 })
							}
							retryAttempt++
							break // Break the for loop to retry with compressed history
						}

						lastMessageAt = Date.now()
						yield* this.processStreamChunk(chunk)
					}
				} catch (streamError) {
					if (streamError instanceof Error && streamError.message === "aborted") {
						throw new KoduError({ code: 1 })
					}
					throw streamError
				}
			}

			// If we've exhausted all retries
			throw new Error("Maximum retry attempts reached for context compression")
		} catch (error) {
			if (error instanceof Error && error.message === "aborted") {
				error = new KoduError({ code: 1 })
			}
			if (error instanceof AxiosError) {
				error = new KoduError({ code: 1 })
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

		if (shouldAddCriticalMsg && isLastMessageFromUser && Array.isArray(lastMessage.content)) {
			lastMessage.content.push({
				type: "text",
				text: m11182024Prompt.criticalMsg,
			})
		}

		const isFirstRequest = history.length < 2
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
	 */
	private async manageContextWindow(): Promise<"chat_finished" | "compressed"> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference has been garbage collected")
		}
		const history = provider.koduDev?.getStateManager().state.apiConversationHistory || []
		const isAutoSummaryEnabled = provider.getKoduDev()?.getStateManager().autoSummarize ?? false
		// can enable on and of auto summary
		if (!isAutoSummaryEnabled) {
			const updatedMesages = truncateHalfConversation(history)
			await provider.getKoduDev()?.getStateManager().overwriteApiConversationHistory(updatedMesages)
			return "compressed"
		}
		const state = await provider.getStateManager()?.getState()
		const systemPromptTokens = estimateTokenCount({
			role: "assistant",
			content: [{ type: "text", text: this.currentSystemPrompt ?? "" }],
		})
		const metrics = this.getApiMetrics(state?.claudeMessages || [])
		const totalTokens =
			metrics.inputTokens +
			metrics.outputTokens +
			metrics.inputCacheWrite +
			metrics.inputCacheRead +
			systemPromptTokens +
			estimateTokenCount(history[history.length - 1])

		let contextWindow = this.api.getModel().info.contextWindow
		const terminalCompressionThreshold = provider
			.getGlobalStateManager()
			.getGlobalState("terminalCompressionThreshold")
		const compressedMessages = await smartTruncation(history, this.api, terminalCompressionThreshold)
		const newMemorySize = compressedMessages.reduce((acc, message) => acc + estimateTokenCount(message), 0)
		this.log("info", `API History before compression:`, history)
		this.log("info", `Total tokens before compression: ${totalTokens}`)
		this.log("info", `Total tokens after compression: ${newMemorySize}`)
		const maxPostTruncationTokens = contextWindow - 13_314 + this.api.getModel().info.maxTokens
		await provider.getKoduDev()?.getStateManager().overwriteApiConversationHistory(compressedMessages)

		// if this condition hit the task should be blocked
		if (newMemorySize >= maxPostTruncationTokens) {
			// we reached the end
			this.providerRef
				.deref()
				?.getKoduDev()
				?.taskExecutor.say(
					"chat_finished",
					`The chat has reached the maximum token limit. Please create a new task to continue.`
				)
			this.providerRef.deref()?.getKoduDev()?.taskExecutor.blockTask()
			return "chat_finished"
		}
		await this.providerRef
			.deref()
			?.getKoduDev()
			?.taskExecutor.say(
				"chat_truncated",
				JSON.stringify({
					before: totalTokens,
					after: newMemorySize,
				})
			)
		return "compressed"
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
