import { Anthropic } from "@anthropic-ai/sdk"
import axios, { CancelTokenSource } from "axios"
import { ApiHandler, withoutImageData } from ".."
import { ApiHandlerOptions, KoduModelId, ModelInfo, koduDefaultModelId, koduModels } from "../../shared/api"
import {
	KODU_ERROR_CODES,
	KoduError,
	getKoduCurrentUser,
	getKoduInferenceUrl,
	getKoduWebSearchUrl,
	koduErrorMessages,
	koduSSEResponse,
} from "../../shared/kodu"
import { WebSearchResponseDto } from "../interfaces"
import { ApiHistoryItem } from "../../agent/v1"
import { cloneDeep } from "lodash"

export async function fetchKoduUser({ apiKey }: { apiKey: string }) {
	const response = await axios.get(getKoduCurrentUser(), {
		headers: {
			"x-api-key": apiKey,
		},
		timeout: 5000,
	})
	if (response.data) {
		return {
			credits: Number(response.data.credits) ?? 0,
			id: response.data.id as string,
			email: response.data.email as string,
			isVisitor: response.data.isVisitor as boolean,
		}
	}
	return null
}

// const findLastMessageTextMsg

export class KoduHandler implements ApiHandler {
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
		let system: Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam[] = []

		let index = 0
		for (const systemMsg of systemPrompt) {
			const shouldCache = index === systemPrompt.length - 1
			system.push({
				type: "text",
				text: systemMsg.trim(),
				// if it's the last or before last message, make it ephemeral
				...(shouldCache ? { cache_control: { type: "ephemeral" } } : {}),
			})
			index++
		}
		const userMsgIndices = messages.reduce(
			(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[] as number[]
		)
		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
		const firstUserMsgIndex = userMsgIndices[0] ?? -1
		const cleanMsgs = cloneDeep(messages)
		// Prepare messages up to the last user message
		let messagesToCache: ApiHistoryItem[] = cleanMsgs.map((msg, index) => {
			const { ts, commitHash, branch, preCommitHash, ...message } = msg

			if (index === lastUserMsgIndex || index === secondLastMsgUserIndex || index === firstUserMsgIndex) {
				return {
					...message,
					content:
						typeof message.content === "string"
							? [
									{
										type: "text",
										text: message.content,
										cache_control: { type: "ephemeral" },
									},
							  ]
							: message.content.map((content, contentIndex) =>
									contentIndex === message.content.length - 1
										? { ...content, cache_control: { type: "ephemeral" } }
										: content
							  ),
				}
			}
			return message
		})

		if (appendAfterCacheToLastMessage && messagesToCache.at(-1) && messagesToCache.at(-1)?.content) {
			appendAfterCacheToLastMessage(messagesToCache.at(-1) as Anthropic.Messages.Message)
		}
		if (updateAfterCacheInserts) {
			;[messagesToCache, system] = await updateAfterCacheInserts(messagesToCache, system)
		}

		// randomMaxTokens between 2200 and 3000
		// const rnd = Math.floor(Math.random() * 800) + 2200

		// Build request body
		const requestBody: Anthropic.Beta.PromptCaching.Messages.MessageCreateParamsNonStreaming = {
			model: modelId,
			// max_tokens: 1800,
			max_tokens: this.getModel().info.maxTokens,
			system,
			messages: messagesToCache,
			temperature: tempature ?? 0.1,
			top_p: top_p ?? undefined,
		}
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(
			getKoduInferenceUrl(),
			{
				...requestBody,
			},
			{
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this._options.koduApiKey || "",
					"continue-generation": "true",
				},
				responseType: "stream",
				signal: abortSignal ?? undefined,
				timeout: 60_000,
			}
		)

		if (response.status !== 200) {
			if (response.status in koduErrorMessages) {
				throw new KoduError({
					code: response.status as keyof typeof koduErrorMessages,
				})
			}
			throw new KoduError({
				code: KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT,
			})
		}

		if (response.data) {
			const reader = response.data
			const decoder = new TextDecoder("utf-8")
			let finalResponse: Extract<koduSSEResponse, { code: 1 }> | null = null
			let partialResponse: Extract<koduSSEResponse, { code: 2 }> | null = null
			let buffer = ""

			for await (const chunk of reader) {
				buffer += decoder.decode(chunk, { stream: true })
				const lines = buffer.split("\n\n")
				buffer = lines.pop() || ""
				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const eventData = JSON.parse(line.slice(6)) as koduSSEResponse
						if (eventData.code === 2) {
							// -> Happens to the current message
							// We have a partial response, so we need to add it to the message shown to the user and refresh the UI
						}
						if (eventData.code === 0) {
						} else if (eventData.code === 1) {
							finalResponse = eventData
						} else if (eventData.code === -1) {
							console.error("Network / API ERROR")
							// we should yield the error and not throw it
						}

						yield eventData
					}
				}

				if (finalResponse) {
					break
				}
			}

			if (!finalResponse) {
				throw new KoduError({
					code: KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT,
				})
			}
		}
	}

	getModel(): { id: KoduModelId; info: ModelInfo } {
		const modelId = this._options.apiModelId
		if (modelId && modelId in koduModels) {
			const id = modelId as KoduModelId
			return { id, info: koduModels[id] }
		}
		return { id: koduDefaultModelId, info: koduModels[koduDefaultModelId] }
	}

	async *sendWebSearchRequest(
		searchQuery: string,
		baseLink?: string,
		browserModel?: string,
		browserMode?: string,
		abortSignal?: AbortSignal
	): AsyncIterable<WebSearchResponseDto> {
		const response = await axios.post(
			getKoduWebSearchUrl(),
			{
				searchQuery,
				baseLink,
				browserModel,
				browserMode,
			},
			{
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this._options.koduApiKey || "",
				},
				timeout: 60_000,
				responseType: "stream",
				signal: abortSignal ?? undefined,
			}
		)

		if (response.data) {
			const reader = response.data
			const decoder = new TextDecoder("utf-8")
			let buffer = ""

			for await (const chunk of reader) {
				buffer += decoder.decode(chunk, { stream: true })
				const lines = buffer.split("\n\n")
				buffer = lines.pop() || ""
				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const eventData = JSON.parse(line.slice(6)) as WebSearchResponseDto
						yield eventData
					}
				}
			}
		}
	}
}
