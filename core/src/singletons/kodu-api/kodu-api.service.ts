import { Anthropic } from "@anthropic-ai/sdk"
import { KoduApiClient } from "./kodu-api-client"
import { ApiClientConfiguration } from "@/types"
import { KoduError, KoduSSEResponse, UserContent, V1ClaudeMessage } from "@/types"
import {
	BASE_SYSTEM_PROMPT,
	CodingBeginnerSystemPromptSection,
	ExperiencedDeveloperSystemPromptSection,
	NonTechnicalSystemPromptSection,
	SYSTEM_PROMPT,
} from "@/ai/prompts"
import { amplitudeTracker, cwd, findLast, isV1ClaudeMessage, truncateHalfConversation } from "@/utils"
import { tools as BaseTools } from "@/ai/tools"
import { stateService } from "../state/state.service"

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

var systemPromptMsgPrev = ""
export class KoduApiService {
	private static instance: KoduApiService
	private api: KoduApiClient | null = null
	private customInstructions?: string

	private constructor() {}

	public static getInstance(): KoduApiService {
		if (!KoduApiService.instance) {
			KoduApiService.instance = new KoduApiService()
		}
		return KoduApiService.instance
	}

	public initialize(configuration: ApiClientConfiguration, customInstructions?: string): void {
		this.api = new KoduApiClient({ koduApiKey: configuration.koduApiKey, apiModelId: configuration.apiModelId })
		this.customInstructions = customInstructions
	}

	public getApi(): KoduApiClient {
		if (!this.api) {
			throw new Error("KoduApiService has not been initialized. Call initialize() first.")
		}
		return this.api
	}

	public getModelId() {
		return this.getApi().getModel().id
	}

	abortRequest(): void {
		this.getApi().abortRequest()
	}

	updateApi(configuration: ApiClientConfiguration): void {
		console.log("Updating API configuration", configuration)
		this.api = new KoduApiClient({ koduApiKey: configuration.koduApiKey, apiModelId: configuration.apiModelId })
	}

	updateCustomInstructions(customInstructions: string | undefined): void {
		this.customInstructions = customInstructions
	}

	async *createApiStreamRequest(
		apiConversationHistory: Anthropic.MessageParam[],
		abortSignal?: AbortSignal | null
	): AsyncGenerator<KoduSSEResponse> {
		// @TODO: refactor
		// const creativeMode = (await this.providerRef.deref()?.getStateManager()?.getState())?.creativeMode ?? "normal"
		const creativeMode = "normal"
		const technicalBackground = "no-technical"

		let systemPrompt = await SYSTEM_PROMPT()
		let tools = BaseTools
		systemPrompt += `
		===
USER PERSONALIZED INSTRUCTIONS

${
	technicalBackground === "no-technical"
		? NonTechnicalSystemPromptSection
		: technicalBackground === "technical"
		? ExperiencedDeveloperSystemPromptSection
		: CodingBeginnerSystemPromptSection
}
		`
		let customInstructions: string | undefined
		if (this.customInstructions && this.customInstructions.trim()) {
			customInstructions += `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user. They should be followed and given precedence in case of conflicts with previous instructions.

${this.customInstructions.trim()}
`
		}
		const newSystemPrompt = await BASE_SYSTEM_PROMPT(cwd, true, technicalBackground)

		const claudeMessages = stateService.state.claudeMessages
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
			const lastV1Message = reversedClaudeMessages?.find((m) => isV1ClaudeMessage(m) && m.apiMetrics)
			if (lastV1Message) {
				apiMetrics = (lastV1Message as V1ClaudeMessage).apiMetrics!
			}
		}

		const totalTokens =
			(apiMetrics.inputTokens || 0) +
			(apiMetrics.outputTokens || 0) +
			(apiMetrics.inputCacheWrite || 0) +
			(apiMetrics.inputCacheRead || 0) +
			anthropicMessageToTokens(apiConversationHistory.at(-1)!)
		const contextWindow = this.getApi().getModel().info.contextWindow

		if (totalTokens >= contextWindow * 0.9) {
			const truncatedMessages = truncateHalfConversation(apiConversationHistory)
			apiConversationHistory = truncatedMessages
			stateService.overwriteApiConversationHistory(truncatedMessages)
		}

		// @TODO: refactor
		// const isFirstRequest = this.providerRef.deref()?.getKoduDev()?.isFirstMessage ?? false
		// on first request, we need to get the environment details with details of the current task and folder
		// const environmentDetails = await this.providerRef.deref()?.getKoduDev()?.getEnvironmentDetails(isFirstRequest)
		// if (isFirstRequest && this.providerRef.deref()?.getKoduDev()) {
		// 	this.providerRef.deref()!.getKoduDev()!.isFirstMessage = false
		// }

		try {
			const stream = await this.getApi().createMessageStream(
				newSystemPrompt.trim(),
				apiConversationHistory,
				creativeMode,
				abortSignal,
				customInstructions,
				stateService.state.memory
				// environmentDetails
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
							// @TODO: refactor
							// this.providerRef
							// 	.deref()
							// 	?.getStateManager()
							// 	?.updateKoduCredits(chunk.body.internal.userCredits)
						}
						const inputTokens = response.usage.input_tokens
						const outputTokens = response.usage.output_tokens
						const cacheCreationInputTokens = (response as any).usage?.cache_creation_input_tokens
						const cacheReadInputTokens = (response as any).usage?.cache_read_input_tokens

						// @TODO: refactor
						// const taskId = (await this.providerRef.deref()?.getState())?.currentTaskId

						const taskId = undefined
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
			throw error
		}
	}

	createUserReadableRequest(userContent: UserContent): string {
		return this.getApi().createUserReadableRequest(userContent)
	}

	calculateApiCost(
		inputTokens: number,
		outputTokens: number,
		cacheCreationInputTokens?: number,
		cacheReadInputTokens?: number
	): number {
		const modelCacheWritesPrice = this.getApi().getModel().info.cacheWritesPrice
		let cacheWritesCost = 0
		if (cacheCreationInputTokens && modelCacheWritesPrice) {
			cacheWritesCost = (modelCacheWritesPrice / 1_000_000) * cacheCreationInputTokens
		}
		const modelCacheReadsPrice = this.getApi().getModel().info.cacheReadsPrice
		let cacheReadsCost = 0
		if (cacheReadInputTokens && modelCacheReadsPrice) {
			cacheReadsCost = (modelCacheReadsPrice / 1_000_000) * cacheReadInputTokens
		}
		const baseInputCost = (this.getApi().getModel().info.inputPrice / 1_000_000) * inputTokens
		const outputCost = (this.getApi().getModel().info.outputPrice / 1_000_000) * outputTokens
		const totalCost = cacheWritesCost + cacheReadsCost + baseInputCost + outputCost
		return totalCost
	}
}

// Export a default instance
export const koduApiService = KoduApiService.getInstance()
