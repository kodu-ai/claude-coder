/**
 * @fileoverview API Manager for handling Claude API interactions
 * This module manages API communications with the Anthropic Claude API, handling message streams,
 * token calculations, and conversation history management.
 */

import Anthropic from "@anthropic-ai/sdk"
import { AxiosError } from "axios"
import { findLast, first } from "lodash"
import { ApiConfiguration, ApiHandler, buildApiHandler } from "../../api"
import { ExtensionProvider } from "../../providers/claude-coder/ClaudeCoderProvider"
import { koduModels } from "../../shared/api"
import { isV1ClaudeMessage, V1ClaudeMessage } from "../../shared/ExtensionMessage"
import { KoduError, koduSSEResponse } from "../../shared/kodu"
import { amplitudeTracker } from "../../utils/amplitude"
import { estimateTokenCount, smartTruncation, truncateHalfConversation } from "../../utils/context-managment"
import { BASE_SYSTEM_PROMPT, criticalMsg } from "./prompts/base-system"
import { ClaudeMessage, UserContent } from "./types"
import { getCwd, isTextBlock } from "./utils"
import { writeFile } from "fs/promises"
import path from "path"
import { GlobalStateManager } from "../../providers/claude-coder/state/GlobalStateManager"
import { hardRollbackToStart } from "../../utils/command"

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
		this.currentSystemPrompt = systemPrompt

		const executeRequest = async () => {
			const conversationHistory =
				provider.koduDev?.getStateManager().state.apiConversationHistory || apiConversationHistory

			let apiConversationHistoryCopy = conversationHistory.slice()

			// make sure the last message is from the user
			const lastUserMessageIndx = apiConversationHistoryCopy.map((m) => m.role).lastIndexOf("user")
			// slice the conversation history to the last user message
			apiConversationHistoryCopy = apiConversationHistoryCopy.slice(0, lastUserMessageIndx + 1)
			// Process conversation history and manage context window
			await this.processConversationHistory(apiConversationHistoryCopy)

			// log the last 2 messages
			this.log("info", `Last 2 messages:`, apiConversationHistoryCopy.slice(-2))
			const RUN_MULTIPLE_LOGS = false

			if (RUN_MULTIPLE_LOGS) {
				const extraRuns = 0
				// we will only log to disk the results of the run and make it all in the background we will not yield the results
				const backgroundJob = async () => {
					const promises = Array.from({ length: extraRuns }, async (_, i) => {
						console.log(`Running background job ${i}`)
						const stream = await this.api.createMessageStream(
							systemPrompt.trim(),
							apiConversationHistoryCopy,
							creativeMode,
							abortSignal,
							customInstructions
						)
						for await (const chunk of stream) {
							if (chunk.code === 1) {
								// write to disk the output content
								// @ts-expect-error
								const content = chunk.body.anthropic?.content[0].text as string
								const fileName = `output-${Date.now()}-${i}.txt`
								// write it to the current directory at logs/output-<timestamp>.txt
								const absolutePath = path.join(__dirname, "logs", "continue-generation", fileName)
								console.log(`Writing to disk: ${absolutePath}`)
								await writeFile(absolutePath, content, "utf-8")
								return
							}
						}
					})
					await Promise.all(promises)
				}
				backgroundJob()
					.then(() => {
						console.log("Background job finished")
					})
					.catch((error) => {
						console.error("Background job failed", error)
					})
			}

			const stream = await this.api.createMessageStream(
				systemPrompt.trim(),
				apiConversationHistoryCopy,
				creativeMode,
				abortSignal,
				customInstructions
			)

			return stream
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

			let retryAttempt = 0
			const MAX_RETRIES = 3

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
						if (chunk.code === -1) {
							console.log("Error in stream", chunk.body.msg)
						}

						if (
							(chunk.code === -1 && chunk.body.msg?.includes("prompt is too long")) ||
							(chunk.code === -1 && chunk.body.msg?.includes("middle-out")) ||
							(chunk.code === -1 &&
								chunk.body.msg?.includes("transform to compress your prompt automatically"))
						) {
							// clear the interval
							clearInterval(checkInactivity)
							// Compress the context and retry
							// await this.newCompression(apiConversationHistory, abortSignal)
							await this.manageContextWindow()
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

	private async newCompression(history: Anthropic.MessageParam[], abortSignal?: AbortSignal | null): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference has been garbage collected")
		}
		console.log(`Hard compression started`)
		const koduDev = provider.getKoduDev()
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
		// first message is task description
		const firstMessage = history[0]

		// Create copy instead of mutating original array
		const newHistory = history.slice(0, -2)
		if (newHistory.at(-1)?.role === "assistant") {
			newHistory.pop()
		}
		const lastMessage = newHistory.at(-1)
		if (lastMessage?.role === "user") {
			if (Array.isArray(lastMessage.content)) {
				lastMessage.content.push({
					type: "text",
					text: `The chat has reached the maximum token limit.
					It's time to self-reflect and critque your work so far,
					You should evaulate every single step you have taken and see if you can improve it.
					Your evaulation, self reflect and critque will be used to continue the conversation on a empty slate.
					This means you forgot everything you have done so far and you are starting from scratch.
					You you will be using your evaulation, self reflect and critque to guide yourself to a better conversation quality quickly.
					This means you should mention what important files have you read, what important information you have gathered, what important steps you have taken and what important decisions you have made.
					What edits didn't go well, what edits went well. What you have learned from the conversation so far and what parts are you looking forward to improve.
					You will rollback to the start of the conversation and your project will be reset to the start of the conversation it means you will lose all the progress you have made so far.
					And have to start from scratch based on your evaulation, self reflect and critque it will make it quickly to pick up all the good progress you have made.
					Please mention clearly which files to read and why, which edits you should change and why, which commands you should run and why.
					Please mention which edits you tried and didn't go well and why, which edits you tried and went well and why.
					This is critical, red team your work, be your own devil's advocate, be your own critic, be your own judge, be your own jury.
					This is a critical step to improve the quality of the conversation quickly.

					`,
				})
			}
		}
		console.log(`New history last item:`, newHistory[newHistory.length - 1])

		try {
			const stream = await this.api.createMessageStream(
				systemPrompt.trim(),
				newHistory,
				creativeMode,
				abortSignal,
				customInstructions
			)

			for await (const chunk of stream) {
				if (chunk.code === 1 && chunk.body.anthropic.content && isTextBlock(chunk.body.anthropic.content[0])) {
					const finalText = chunk.body.anthropic.content[0].text
					console.log(`Observation:\n${finalText}`)
					if (Array.isArray(firstMessage.content)) {
						firstMessage.content.push({
							type: "text",
							text: `Here are some critical observations we have found from running the task before:
							<observation>
							${finalText}
							</observation>
							`,
						})
						await koduDev?.getStateManager().overwriteApiConversationHistory([firstMessage])
						await hardRollbackToStart()
					}
					return
				}
			}
		} catch (error) {
			console.error("Compression failed:", error)
			throw error
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

		const lastMessage = history[history.length - 1]
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

		// Add critical messages every 3th message or the first message
		const shouldAddCriticalMsg = history.length % 7 === 0 || history.length === 1
		console.log(`current position in history: ${history.length}`)

		const lastMessage = history[history.length - 1]

		const shouldAppendCriticalMsg =
			(await this.providerRef.deref()?.getState())?.activeSystemPromptVariantId === "m-11-1-2024"

		if (
			shouldAddCriticalMsg &&
			isLastMessageFromUser &&
			Array.isArray(lastMessage.content) &&
			shouldAppendCriticalMsg
		) {
			console.log(`Appending critical message current position in history: ${history.length}`)
			const isInlineEditMode = await GlobalStateManager.getInstance().getGlobalState("isInlineEditingEnabled")
			if (isInlineEditMode) {
				const newCriticalMsg = (await import("./prompts/m-11-20-2024.prompt")).criticalMsg
				lastMessage.content.push({
					type: "text",
					text: newCriticalMsg,
				})
			} else {
				lastMessage.content.push({
					type: "text",
					text: criticalMsg,
				})
			}
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
		// we are going to inject to the last message some information regarding the conversation to mention that we compressed previous messages
		for (const m of compressedMessages.slice(-2)) {
			if (m.role === "user") {
				if (Array.isArray(m.content)) {
					m.content.push({
						type: "text",
						text: `
	<compression_additional_context>
	The chat has been compressed to prevent context window token overflow, it means that previous messages before this message might have been compressed.
	You should take a moment to see what context are you missing that is critical to retrieve before you continue the conversation, this will let you refresh your context and gather all the relevant context parts before you continue solving the task.
	This is a critical step that should not be skipped, you should take your time to understand the context and gather the information you need.
	Also it might be a good time to self reflect and check how is your progress so far, what you have learned.
	remember to always follow the <task> information from the first message in the conversation.
	Good luck and lets pick up the conversation from the current message.
	</compression_additional_context>`.trim(),
					})
				}
			}
		}
		console.log(
			`last two messages after compression:`,
			JSON.stringify(compressedMessages[compressedMessages.length - 2].content)
		)

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
			await this.providerRef.deref()?.getKoduDev()?.taskExecutor.blockTask()
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
