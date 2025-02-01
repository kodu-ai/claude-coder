import { CancelTokenSource } from "axios"
import { ApiConstructorOptions, ApiHandler, ApiHandlerOptions } from ".."
import { koduSSEResponse } from "../../shared/kodu"
import { CoreMessage, smoothStream, streamText } from "ai"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createOpenAI } from "@ai-sdk/openai"
import { createMistral } from "@ai-sdk/mistral"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { convertToAISDKFormat } from "../../utils/ai-sdk-format"
import { customProviderSchema, ModelInfo } from "./types"
import { PROVIDER_IDS } from "./constants"
import { calculateApiCost } from "../api-utils"
import { mistralConfig } from "./config/mistral"
import { version } from "../../../package.json"
import { z } from "zod"

type ExtractCacheTokens = {
	cacheCreationField: string
	cacheReadField: string
	object: Object
}

const extractCacheTokens = ({ cacheCreationField, cacheReadField, object }: ExtractCacheTokens) => {
	const cacheSchema = z.object({
		[cacheCreationField]: z.number().nullable(),
		[cacheReadField]: z.number().nullable(),
	})
	const cache = cacheSchema.safeParse(object)
	if (!cache.success) {
		return {
			cache_creation_input_tokens: null,
			cache_read_input_tokens: null,
		}
	}
	return {
		cache_creation_input_tokens: cache.data[cacheCreationField],
		cache_read_input_tokens: cache.data[cacheReadField],
	}
}

export class CustomProviderError extends Error {
	private _providerId: string
	private _modelId: string
	constructor(message: string, providerId: string, modelId: string) {
		super(message)
		this.name = "CustomProviderError"
		this._providerId = providerId
		this._modelId = modelId
	}

	get providerId() {
		return this._providerId
	}
	get modelId() {
		return this._modelId
	}
}

const providerToAISDKModel = (settings: ApiConstructorOptions, modelId: string) => {
	switch (settings.providerSettings.providerId) {
		case PROVIDER_IDS.DEEPSEEK:
			if (!settings.providerSettings.apiKey) {
				throw new CustomProviderError("Deepseek Missing API key", settings.providerSettings.providerId, modelId)
			}
			return createDeepSeek({
				apiKey: settings.providerSettings.apiKey,
			}).languageModel(modelId)
		case PROVIDER_IDS.MISTRAL:
			if (!settings.providerSettings.apiKey) {
				throw new CustomProviderError("Mistral Missing API key", settings.providerSettings.providerId, modelId)
			}
			return createMistral({
				apiKey: settings.providerSettings.apiKey,
				baseURL: mistralConfig.baseUrl,
			}).languageModel(modelId)
		case PROVIDER_IDS.OPENAI:
			if (!settings.providerSettings.apiKey) {
				throw new CustomProviderError("OpenAI Missing API key", settings.providerSettings.providerId, modelId)
			}
			const openaiModelId = modelId.includes("o3-mini") ? "o3-mini" : modelId
			const reasoningEffort = modelId.includes("o3-mini")
				? {
						reasoningEffort: modelId.includes("high") ? ("high" as const) : ("medium" as const),
				  }
				: undefined
			return createOpenAI({
				apiKey: settings.providerSettings.apiKey,
				compatibility: "strict",
			}).languageModel(openaiModelId, reasoningEffort)
		case PROVIDER_IDS.GOOGLE_GENAI:
			if (!settings.providerSettings.apiKey) {
				throw new CustomProviderError(
					"Google GenerativeAI Missing API key",
					settings.providerSettings.providerId,
					modelId
				)
			}
			return createGoogleGenerativeAI({
				apiKey: settings.providerSettings.apiKey,
			}).languageModel(modelId)
		case PROVIDER_IDS.OPENAICOMPATIBLE:
			const providerSettings = customProviderSchema.safeParse(settings.providerSettings)
			if (!providerSettings.success) {
				throw new CustomProviderError(
					"OpenAI Compatible Missing API key",
					settings.providerSettings.providerId,
					modelId
				)
			}
			return createOpenAI({
				apiKey: providerSettings.data.apiKey,
				compatibility: "compatible",
				baseURL: providerSettings.data.baseUrl,
				name: providerSettings.data.modelId,
				headers: {
					"User-Agent": `Kodu/${version}`
				}
			}).languageModel(modelId)

		default:
			throw new CustomProviderError("Provider not configured", settings.providerSettings.providerId, modelId)
	}
}

export class CustomApiHandler implements ApiHandler {
	private _options: ApiConstructorOptions
	private cancelTokenSource: CancelTokenSource | null = null

	get options() {
		return this._options
	}

	constructor(options: ApiConstructorOptions) {
		this._options = options
	}

	async abortRequest(): Promise<void> {
		if (this.cancelTokenSource) {
			this.cancelTokenSource.cancel("Request aborted by user")
			this.cancelTokenSource = null
		}
	}

	async *createMessageStream({
		messages,
		systemPrompt,
		top_p,
		tempature,
		abortSignal,
		modelId,
		appendAfterCacheToLastMessage,
		updateAfterCacheInserts,
	}: Parameters<ApiHandler["createMessageStream"]>[0]): AsyncIterableIterator<koduSSEResponse> {
		const convertedMessages: CoreMessage[] = []

		for (const systemMsg of systemPrompt) {
			convertedMessages.push({
				role: "system",
				content: systemMsg.trim(),
				// if it's the last or before last message, make it ephemeral
			})
		}

		const convertedMessagesFull = convertedMessages.concat(convertToAISDKFormat(messages))
		const currentModel = this._options.models.find((m) => m.id === modelId) ?? this._options.model

		// const refetchSignal = new SmartAbortSignal(5000)
		const result = streamText({
			model: providerToAISDKModel(this._options, modelId),
			// prompt: `This is a test tell me a random fact about the world`,
			messages: convertedMessagesFull,
			temperature: currentModel.id === "deepseek-reasoner" ? undefined : tempature ?? 0.1, // deepseek-reasoner doesn't support temperature
			topP: top_p ?? undefined,
			stopSequences: ["</kodu_action>"],
			abortSignal: abortSignal ?? undefined,
			experimental_transform: smoothStream(),
			maxRetries: 3,
		})

		let text = ""
		for await (const part of result.fullStream) {
			if (part.type === "reasoning") {
				yield {
					code: 4,
					body: {
						reasoningDelta: part.textDelta,
					},
				}
			}
			if (part.type === "text-delta") {
				text += part.textDelta
				yield {
					code: 2,
					body: {
						text: part.textDelta,
					},
				}
			}
			if (part.type === "finish") {
				let cache_creation_input_tokens: number | null = null
				let cache_read_input_tokens: number | null = null
				if (
					this._options.providerSettings.providerId === PROVIDER_IDS.DEEPSEEK &&
					part.experimental_providerMetadata
				) {
					;({ cache_creation_input_tokens, cache_read_input_tokens } = extractCacheTokens({
						cacheCreationField: "promptCacheMissTokens",
						cacheReadField: "promptCacheHitTokens",
						object: part.experimental_providerMetadata["deepseek"],
					}))
				}
				if (this._options.providerSettings.providerId === PROVIDER_IDS.OPENAI) {
					const cachedPromptTokens = part.experimental_providerMetadata?.["openai"]?.cachedPromptTokens
					if (typeof cachedPromptTokens === "number") {
						cache_read_input_tokens = cachedPromptTokens
						// total_tokens - cache_read_input_tokens = cache_creation_input_tokens
						cache_creation_input_tokens = part.usage.promptTokens - cache_read_input_tokens
					}
				}
				const inputTokens =
					part.usage.promptTokens - (cache_creation_input_tokens ?? 0) - (cache_read_input_tokens ?? 0)
				yield {
					code: 1,
					body: {
						anthropic: {
							content: [
								{
									type: "text",
									text,
								},
							],
							id: "1",
							role: "assistant",
							stop_reason: "stop_sequence",
							type: "message",
							stop_sequence: "</kodu_action>",
							model: modelId,
							usage: {
								input_tokens: inputTokens,
								output_tokens: part.usage.completionTokens,
								cache_creation_input_tokens,
								cache_read_input_tokens,
							},
						},
						internal: {
							cost: calculateApiCost(
								currentModel,
								inputTokens,
								part.usage.completionTokens,
								cache_creation_input_tokens ?? 0,
								cache_read_input_tokens ?? 0
							),
							inputTokens: inputTokens,
							outputTokens: part.usage.completionTokens,
							cacheCreationInputTokens: cache_creation_input_tokens ?? 0,
							cacheReadInputTokens: cache_read_input_tokens ?? 0,
						},
					},
				}
			}
			if (part.type === "error") {
				console.error(part.error)
				throw part.error
				// if (part.error instanceof Error) {
				// 	yield {
				// 		code: -1,
				// 		body: {
				// 			msg: part.error.message ?? "Unknown error",
				// 			status: 500,
				// 		},
				// 	}
				// }
			}
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this._options.model.id,
			info: this._options.model,
		}
	}
}
