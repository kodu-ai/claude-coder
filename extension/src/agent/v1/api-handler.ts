import { Anthropic } from '@anthropic-ai/sdk'
import { ApiConfiguration, ApiHandler, buildApiHandler } from '../../api'
import { ExtensionProvider } from '../../providers/claude-coder/ClaudeCoderProvider'
import { KoduError, koduSSEResponse } from '../../shared/kodu'
import { amplitudeTracker } from '../../utils/amplitude'
import { truncateHalfConversation } from '../../utils/context-management'
import { BASE_SYSTEM_PROMPT } from './prompts/base-system'
import {
	CodingBeginnerSystemPromptSection,
	ExperiencedDeveloperSystemPromptSection,
	NonTechnicalSystemPromptSection,
	SYSTEM_PROMPT,
} from './system-prompt'
import { manageTokensAndConversation } from './tools/manage-conversation'
import { UserContent } from './types'
import { getCwd } from './utils'

/**
 *
 * @description every 3 letters are on avg 1 token, image is about 2000 tokens
 * @param message the last message
 * @returns the tokens from the message
 */
export const anthropicMessageToTokens = (message: Anthropic.MessageParam) => {
	const content = message.content
	if (typeof content === 'string') {
		return Math.round(content.length / 2)
	}
	const textBlocks = content.filter((block) => block.type === 'text')
	const text = textBlocks.map((block) => block.text).join('')
	const textTokens = Math.round(text.length / 3)
	const imgBlocks = content.filter((block) => block.type === 'image')
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
		console.log('Updating API configuration', apiConfiguration)
		this.api = buildApiHandler(apiConfiguration)
	}

	updateCustomInstructions(customInstructions: string | undefined): void {
		this.customInstructions = customInstructions
	}
	async *createBaseMessageStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		abortSignal?: AbortSignal | null,
		tempature: number = 0,
		top_p: number = 0.9,
	): AsyncGenerator<koduSSEResponse> {
		try {
			const stream = await this.api.createBaseMessageStream(
				systemPrompt,
				messages,
				abortSignal,
				tempature,
				top_p,
			)

			for await (const chunk of stream) {
				switch (chunk.code) {
					case 0:
						console.log('Health check received')
						break
					case 1:
						console.log('finalResponse', chunk)
						// we always reach here
						const response = chunk.body.anthropic
						// update state of credit
						if (chunk.body.internal.userCredits !== undefined) {
							console.log('Updating kodu credits', chunk.body.internal.userCredits)
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
							cacheReadInputTokens,
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
				console.error('KODU API request failed', error)
			}
			throw error
		}
	}

	async *createApiStreamRequest(
		apiConversationHistory: Anthropic.MessageParam[],
		abortSignal?: AbortSignal | null,
	): AsyncGenerator<koduSSEResponse> {
		const creativeMode = (await this.providerRef.deref()?.getStateManager()?.getState())?.creativeMode ?? 'normal'
		const technicalBackground =
			(await this.providerRef.deref()?.getStateManager()?.getState())?.technicalBackground ?? 'no-technical'
		let systemPrompt = await SYSTEM_PROMPT()
		systemPrompt += `
		===
USER PERSONALIZED INSTRUCTIONS

${
	technicalBackground === 'no-technical'
		? NonTechnicalSystemPromptSection
		: technicalBackground === 'technical'
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
		const newSystemPrompt = await BASE_SYSTEM_PROMPT(getCwd(), true, technicalBackground)

		const { percentageUsed } = await manageTokensAndConversation(this.providerRef, apiConversationHistory)
		if (percentageUsed > 0.9) {
			const truncatedMessages = truncateHalfConversation(apiConversationHistory)
			apiConversationHistory = truncatedMessages
			this.providerRef.deref()?.getKoduDev()?.getStateManager().overwriteApiConversationHistory(truncatedMessages)
		}
		const isFirstRequest = this.providerRef.deref()?.getKoduDev()?.isFirstMessage ?? false
		// on first request, we need to get the environment details with details of the current task and folder
		const environmentDetails = await this.providerRef.deref()?.getKoduDev()?.getEnvironmentDetails(isFirstRequest)
		if (isFirstRequest && this.providerRef.deref()?.getKoduDev()) {
			this.providerRef.deref()!.getKoduDev()!.isFirstMessage = false
		}

		try {
			const stream = await this.api.createMessageStream(
				newSystemPrompt.trim(),
				apiConversationHistory,
				creativeMode,
				abortSignal,
				customInstructions,
				await this.providerRef.deref()?.getKoduDev()?.getStateManager().state.memory,
				environmentDetails,
			)

			for await (const chunk of stream) {
				switch (chunk.code) {
					case 0:
						console.log('Health check received')
						break
					case 1:
						console.log('finalResponse', chunk)
						// we always reach here
						const response = chunk.body.anthropic
						// update state of credit
						if (chunk.body.internal.userCredits !== undefined) {
							console.log('Updating kodu credits', chunk.body.internal.userCredits)
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
							cacheReadInputTokens,
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
				console.error('KODU API request failed', error)
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
		cacheReadInputTokens?: number,
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
