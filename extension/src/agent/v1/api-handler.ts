import { Anthropic } from "@anthropic-ai/sdk"
import { ApiConfiguration, ApiHandler, buildApiHandler } from "../../api"
import { KoduError, koduSSEResponse } from "../../shared/kodu"
import { UserContent } from "./types"
import { amplitudeTracker } from "../../utils/amplitude"
import { truncateHalfConversation } from "../../utils/context-management"
import {
	CodingBeginnerSystemPromptSection,
	ExperiencedDeveloperSystemPromptSection,
	NonTechnicalSystemPromptSection,
} from "./system-prompt"
import { ExtensionProvider } from "../../providers/claude-coder/ClaudeCoderProvider"
import { tools as baseTools } from "./tools/tools"
import { findLast } from "../../utils"
import delay from "delay"
import { BASE_SYSTEM_PROMPT, criticalMsg } from "./prompts/base-system"
import { getCwd } from "./utils"
import { isV1ClaudeMessage, V1ClaudeMessage } from "../../shared/ExtensionMessage"
import { AxiosError } from "axios"
import { koduModels } from "../../shared/api"
import { Message } from "@anthropic-ai/sdk/resources/messages.mjs"

/**
 *
 * @description every 3 letters are on avg 1 token, image is about 2000 tokens
 * @param message the last message
 * @returns the tokens from the message
 */
const anthropicMessageToTokens = (message: Anthropic.MessageParam) => {
	const content = message.content
	if (typeof content === "string") {
		return Math.round(content.length / 2)
	}
	const textBlocks = content.filter((block) => block.type === "text")
	const text = textBlocks.map((block) => block.text).join("")
	const textTokens = Math.round(text.length / 3)
	const imgBlocks = content.filter((block) => block.type === "image")
	const imgTokens = imgBlocks.length * 2000
	return Math.round(textTokens + imgTokens)
}

interface Difference {
	index: number
	char1: string
	char2: string
}

export function findStringDifferences(str1: string, str2: string): Difference[] {
	const differences: Difference[] = []

	// Make sure both strings are the same length for comparison
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

export class ApiManager {
	private api: ApiHandler
	private customInstructions?: string
	private providerRef: WeakRef<ExtensionProvider>

	constructor(provider: ExtensionProvider, apiConfiguration: ApiConfiguration, customInstructions?: string) {
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
		const technicalBackground =
			(await this.providerRef.deref()?.getStateManager()?.getState())?.technicalBackground ?? "no-technical"
		const isImageSupported = koduModels[this.getModelId()].supportsImages

		let customInstructions: string | undefined
		if (this.customInstructions && this.customInstructions.trim()) {
			customInstructions += `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user. They should be followed and given precedence in case of conflicts with previous instructions.

${this.customInstructions.trim()}
`
		}
		const newSystemPrompt = await BASE_SYSTEM_PROMPT(getCwd(), !!isImageSupported, technicalBackground)

		const claudeMessages = (await this.providerRef.deref()?.getStateManager()?.getState())?.claudeMessages
		let apiMetrics: NonNullable<V1ClaudeMessage["apiMetrics"]> = {
			inputTokens: 0,
			outputTokens: 0,
			inputCacheRead: 0,
			inputCacheWrite: 0,
			cost: 0,
		}
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
			apiMetrics = {
				inputCacheRead: cacheReads || 0,
				inputCacheWrite: cacheWrites || 0,
				inputTokens: tokensIn || 0,
				outputTokens: tokensOut || 0,
				cost: 0,
			}
		} else {
			// reverse claude messages to find the last message that is typeof v1 and has apiMetrics
			const reversedClaudeMessages = claudeMessages?.slice().reverse()
			const lastV1Message = reversedClaudeMessages?.find((m) => isV1ClaudeMessage(m) && m?.apiMetrics)
			if (lastV1Message) {
				apiMetrics = (lastV1Message as V1ClaudeMessage)?.apiMetrics!
			}
		}
		const isFirstRequest = this.providerRef.deref()?.getKoduDev()?.isFirstMessage ?? false
		// on first request, we need to get the environment details with details of the current task and folder
		const environmentDetails = await this.providerRef.deref()?.getKoduDev()?.getEnvironmentDetails(isFirstRequest)
		if (isFirstRequest && this.providerRef.deref()?.getKoduDev()) {
			this.providerRef.deref()!.getKoduDev()!.isFirstMessage = false
		}
		// every 4 messages, add a critical message and on first message
		const shouldAddCriticalMsg = apiConversationHistory.length % 4 === 0 || apiConversationHistory.length === 1
		const lastMessage = apiConversationHistory[apiConversationHistory.length - 1]

		if (typeof lastMessage.content === "string") {
			lastMessage.content = [
				{
					type: "text",
					text: lastMessage.content,
				},
			] satisfies Message["content"]
		}
		// Add critical messages if needed
		if (shouldAddCriticalMsg) {
			if (Array.isArray(lastMessage.content)) {
				lastMessage.content.push({
					type: "text",
					text: criticalMsg,
				})
			}
		}
		if (Array.isArray(lastMessage.content) && environmentDetails) {
			lastMessage.content.push({
				text: environmentDetails,
				type: "text",
			})
		}
		// override the api conversation history with the updated messages
		await this.providerRef
			.deref()
			?.getKoduDev()
			?.getStateManager()
			.overwriteApiConversationHistory(apiConversationHistory)

		const totalTokens =
			(apiMetrics.inputTokens || 0) +
			(apiMetrics.outputTokens || 0) +
			(apiMetrics.inputCacheWrite || 0) +
			(apiMetrics.inputCacheRead || 0) +
			anthropicMessageToTokens(apiConversationHistory.at(-1)!)
		const contextWindow = this.api.getModel().info.contextWindow

		if (totalTokens >= contextWindow * 0.9) {
			const truncatedMessages = truncateHalfConversation(apiConversationHistory)
			apiConversationHistory = truncatedMessages
			await this.providerRef
				.deref()
				?.getKoduDev()
				?.getStateManager()
				.overwriteApiConversationHistory(truncatedMessages)
		}

		try {
			const stream = await this.api.createMessageStream(
				newSystemPrompt.trim(),
				apiConversationHistory,
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
						break
				}
				yield chunk
			}
		} catch (error) {
			if (error instanceof KoduError) {
				console.error("KODU API request failed", error)
			}
			if (error instanceof AxiosError) {
				throw new KoduError({
					code: error.response?.status || 500,
				})
			}

			throw error
		}
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
