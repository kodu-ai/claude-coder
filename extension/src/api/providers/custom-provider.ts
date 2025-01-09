import { CancelTokenSource } from "axios"
import { ApiHandler } from ".."
import { ApiHandlerOptions, KoduModelId, ModelInfo, customProviderToModelInfo } from "../../shared/api"
import { koduSSEResponse } from "../../shared/kodu"
import { CoreMessage, streamText } from "ai"
import { deepseek } from "@ai-sdk/deepseek"
import { convertToAISDKFormat } from "../../utils/ai-sdk-format"

export class CustomApiHandler implements ApiHandler {
	private _options: ApiHandlerOptions
	private cancelTokenSource: CancelTokenSource | null = null

	get options() {
		return this._options
	}

	get cheapModelId() {
		return this._options.cheapModelId
	}

	constructor(options: ApiHandlerOptions) {
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
		if (!this.options.customProvider) {
			throw new Error("Custom provider not found")
		}
		const convertedMessages: CoreMessage[] = []

		for (const systemMsg of systemPrompt) {
			convertedMessages.push({
				role: "system",
				content: systemMsg.trim(),
				// if it's the last or before last message, make it ephemeral
			})
		}
		convertedMessages.concat(convertToAISDKFormat(messages))

		// Create a transform stream to bridge the callback and the generator
		const { readable, writable } = new TransformStream<koduSSEResponse>()
		const writer = writable.getWriter()

		streamText({
			model: deepseek("deepseek-chat"),
			prompt: "Invent a new holiday and describe its traditions.",
			messages: convertedMessages,
			onChunk({ chunk }) {
				if (chunk.type === "text-delta") {
					// Write the chunk to the transform stream
					writer.write({
						code: 2,
						body: {
							text: chunk.textDelta,
						},
					})
				}
			},
			onFinish(event) {
				writer.write({
					code: 1,
					body: {
						anthropic: {
							content: [
								{
									type: "text",
									text: event.text,
								},
							],
							id: "1",
							role: "assistant",
							stop_reason: "stop_sequence",
							type: "message",
							stop_sequence: "</kodu_action>",
							model: modelId,
							usage: {
								input_tokens: event.usage.promptTokens,
								output_tokens: event.usage.completionTokens,
								cache_creation_input_tokens: null,
								cache_read_input_tokens: null,
							},
						},
						internal: {
							cost: 0,
							userCredits: 0,
							inputTokens: event.usage.promptTokens,
							outputTokens: event.usage.completionTokens,
							cacheCreationInputTokens: 0,
							cacheReadInputTokens: 0,
						},
					},
				})

				writer.close()
			},
			temperature: tempature ?? 0.1,
			topP: top_p ?? undefined,
			stopSequences: ["</kodu_action>"],
			abortSignal: abortSignal ?? undefined,
		})
		// Yield chunks from the transform stream
		const reader = readable.getReader()
		while (true) {
			const { done, value } = await reader.read()
			if (done) {
				break
			}
			yield {
				code: 2,
				body: {
					text: value,
				},
			}
		}
	}

	getModel(): { id: KoduModelId; info: ModelInfo } {
		if (this._options.customProvider) {
			return {
				id: this._options.customProvider.id!,
				info: customProviderToModelInfo(this._options.customProvider),
			}
		}
		throw new Error("Model not found")
	}
}
