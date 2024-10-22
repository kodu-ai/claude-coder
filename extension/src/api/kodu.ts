import { Anthropic } from "@anthropic-ai/sdk"
import axios, { CancelTokenSource } from "axios"
import { z } from "zod"
import { ApiHandler, withoutImageData } from "."
import { ApiHandlerOptions, KoduModelId, ModelInfo, koduDefaultModelId, koduModels } from "../shared/api"
import {
	KODU_ERROR_CODES,
	KoduError,
	getKoduBugReportUrl,
	getKoduConsultantUrl,
	getKoduCurrentUser,
	getKoduInferenceUrl,
	getKoduScreenshotUrl,
	getKoduSummarizeUrl,
	getKoduVisitorUrl,
	getKoduWebSearchUrl,
	koduErrorMessages,
	koduSSEResponse,
} from "../shared/kodu"
import { AskConsultantResponseDto, SummaryResponseDto, WebSearchResponseDto } from "./interfaces"

const temperatures = {
	creative: {
		top_p: 0.9,
		tempature: 0.3,
	},
	normal: {
		top_p: 0.8,
		tempature: 0.2,
	},
	deterministic: {
		top_p: 0.9,
		tempature: 0.1,
	},
} as const

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

export async function initVisitor({ visitorId: vistorId }: { visitorId: string }) {
	const inputSchema = z.object({
		visitorId: z.string(),
	})
	const outputSchema = z.object({
		apiKey: z.string(),
		id: z.string(),
		balance: z.number(),
		credits: z.number(),
	})
	const response = await axios.post(getKoduVisitorUrl(), {
		vistorId: vistorId,
	})
	if (response.data) {
		console.log("response.data", response.data)
		const result = outputSchema.parse(response.data)
		return result
	}
	return null
}

const bugReportSchema = z.object({
	description: z.string(),
	reproduction: z.string(),
	apiHistory: z.string(),
	claudeMessage: z.string(),
})
let previousSystemPrompt = ""

// const findLastMessageTextMsg

export class KoduHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private cancelTokenSource: CancelTokenSource | null = null

	constructor(options: ApiHandlerOptions) {
		this.options = options
	}

	async abortRequest(): Promise<void> {
		if (this.cancelTokenSource) {
			this.cancelTokenSource.cancel("Request aborted by user")
			this.cancelTokenSource = null
		}
	}

	async *createBaseMessageStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		abortSignal?: AbortSignal | null,
		tempature?: number,
		top_p?: number
	): AsyncIterableIterator<koduSSEResponse> {
		const modelId = this.getModel().id
		let requestBody: Anthropic.Beta.PromptCaching.Messages.MessageCreateParamsNonStreaming

		switch (modelId) {
			case "claude-3-5-sonnet-20240620":
			case "claude-3-opus-20240229":
			case "claude-3-haiku-20240307":
				console.log("Matched anthropic cache model")
				const userMsgIndices = messages.reduce(
					(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
					[] as number[]
				)
				const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
				const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
				requestBody = {
					model: modelId,
					max_tokens: this.getModel().info.maxTokens,
					system: systemPrompt,
					messages: messages.map((message, index) => {
						if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
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
					}),
				}
				break
			default:
				console.log("Matched default model")
				requestBody = {
					model: modelId,
					max_tokens: this.getModel().info.maxTokens,
					system: [{ text: systemPrompt, type: "text" }],
					messages,
					temperature: tempature ?? 0.2,
					top_p: top_p ?? 0.8,
				}
		}
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(
			getKoduInferenceUrl(),
			{
				...requestBody,
				temperature: 0.1,
				top_p: 0.9,
			},
			{
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.options.koduApiKey || "",
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

	async *createMessageStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		creativeMode?: "normal" | "creative" | "deterministic",
		abortSignal?: AbortSignal | null,
		customInstructions?: string
	): AsyncIterableIterator<koduSSEResponse> {
		const modelId = this.getModel().id
		const creativitySettings = temperatures[creativeMode ?? "normal"]

		const system: Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam[] = []

		// Add system prompt
		system.push({
			text: systemPrompt.trim(),
			type: "text",
		})

		// Add custom instructions
		if (customInstructions && customInstructions.trim()) {
			system.push({
				text: customInstructions,
				type: "text",
			})
		}

		// Mark the last block with cache_control (First Breakpoint)
		system[system.length - 1].cache_control = { type: "ephemeral" }

		const userMsgIndices = messages.reduce(
			(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[] as number[]
		)

		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
		// Prepare messages up to the last user message
		const messagesToCache: Anthropic.Messages.MessageParam[] = messages.map((message, index) => {
			if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
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

		// Build request body
		const requestBody: Anthropic.Beta.PromptCaching.Messages.MessageCreateParamsNonStreaming = {
			model: modelId,
			max_tokens: this.getModel().info.maxTokens,
			system,
			messages: messagesToCache,
			temperature: 0.1,
			top_p: 0.9,
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
					"x-api-key": this.options.koduApiKey || "",
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
	createUserReadableRequest(
		userContent: Array<
			| Anthropic.TextBlockParam
			| Anthropic.ImageBlockParam
			| Anthropic.ToolUseBlockParam
			| Anthropic.ToolResultBlockParam
		>
	): any {
		// if use udf
		return {
			model: this.getModel().id,
			max_tokens: this.getModel().info.maxTokens,
			system: "(see SYSTEM_PROMPT in src/agent/system-prompt.ts)",
			messages: [{ conversation_history: "..." }, { role: "user", content: withoutImageData(userContent) }],
			tools: "(see tools in src/agent/v1/tools/schema/index.ts)",
			tool_choice: { type: "auto" },
		}
	}

	getModel(): { id: KoduModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in koduModels) {
			const id = modelId as KoduModelId
			return { id, info: koduModels[id] }
		}
		return { id: koduDefaultModelId, info: koduModels[koduDefaultModelId] }
	}

	async sendWebSearchRequest(searchQuery: string, baseLink: string): Promise<WebSearchResponseDto> {
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(
			getKoduWebSearchUrl(),
			{
				searchQuery,
				baseLink,
			},
			{
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.options.koduApiKey || "",
				},
				timeout: 60_000,
				cancelToken: this.cancelTokenSource?.token,
			}
		)

		return response.data
	}

	async sendUrlScreenshotRequest(url: string): Promise<Blob> {
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(
			getKoduScreenshotUrl(),
			{
				url,
			},
			{
				responseType: "arraybuffer",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.options.koduApiKey || "",
				},
				timeout: 60_000,
				cancelToken: this.cancelTokenSource?.token,
			}
		)

		return new Blob([response.data], { type: "image/jpeg" })
	}

	async sendAskConsultantRequest(query: string): Promise<AskConsultantResponseDto> {
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(
			getKoduConsultantUrl(),
			{
				query,
			},
			{
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.options.koduApiKey || "",
				},
				timeout: 60_000,
				cancelToken: this.cancelTokenSource?.token,
			}
		)

		return response.data
	}

	async sendBugReportRequest(bugReport: z.infer<typeof bugReportSchema>) {
		await axios.post(getKoduBugReportUrl(), bugReport, {
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.options.koduApiKey || "",
			},
		})
	}

	async sendSummarizeRequest(output: string, command: string): Promise<SummaryResponseDto> {
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(
			getKoduSummarizeUrl(),
			{
				output,
				command,
			},
			{
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.options.koduApiKey || "",
				},
				timeout: 60_000,
				cancelToken: this.cancelTokenSource?.token,
			}
		)

		return response.data
	}
}
