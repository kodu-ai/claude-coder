import { CancelTokenSource } from "axios"
import { ApiConstructorOptions, ApiHandler, ApiHandlerOptions } from ".."
import { koduSSEResponse } from "../../shared/kodu"
import { CoreMessage, streamText } from "ai"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createOpenAI } from "@ai-sdk/openai"
import { convertToAISDKFormat } from "../../utils/ai-sdk-format"
import { ModelInfo } from "./types"
import { PROVIDER_IDS } from "./constants"

const providerToAISDKModel = (settings: ApiConstructorOptions, modelId: string) => {
	switch (settings.providerSettings.providerId) {
		case PROVIDER_IDS.DEEPSEEK:
			return createDeepSeek({
				apiKey: settings.providerSettings.apiKey,
			}).languageModel(modelId)
		case PROVIDER_IDS.OPENAI:
			return createOpenAI({
				apiKey: settings.providerSettings.apiKey,
			}).languageModel(modelId)
		default:
			throw new Error("Invalid provider")
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

		const result = streamText({
			model: providerToAISDKModel(this._options, modelId),
			// prompt: `This is a test tell me a random fact about the world`,
			messages: convertedMessagesFull,
			temperature: tempature ?? 0.1,
			topP: top_p ?? undefined,
			stopSequences: ["</kodu_action>"],
			abortSignal: abortSignal ?? undefined,
		})
		let text = ""
		for await (const part of result.fullStream) {
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
								input_tokens: part.usage.promptTokens,
								output_tokens: part.usage.completionTokens,
								cache_creation_input_tokens: null,
								cache_read_input_tokens: null,
							},
						},
						internal: {
							cost: 0,
							userCredits: 0,
							inputTokens: part.usage.promptTokens,
							outputTokens: part.usage.completionTokens,
							cacheCreationInputTokens: 0,
							cacheReadInputTokens: 0,
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
