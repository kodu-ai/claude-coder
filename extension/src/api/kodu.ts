import { Anthropic } from "@anthropic-ai/sdk"
import axios, { CancelTokenSource } from "axios"
import { z } from "zod"
import { ApiHandler, withoutImageData } from "."
import { ApiHandlerOptions, KoduModelId, ModelInfo, koduDefaultModelId, koduModels } from "../shared/api"
import {
	KODU_ERROR_CODES,
	KoduError,
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
import { ApiHistoryItem } from "../agent/v1"
import { GlobalStateManager } from "../providers/claude-coder/state/GlobalStateManager"
import { getCwd } from "../agent/v1/utils"

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

	async fixUdiff(udiff: string, fileContent: string, relPath: string): Promise<string> {
		const requestBody: Anthropic.Beta.PromptCaching.Messages.MessageCreateParamsNonStreaming = {
			model: "claude-3-5-sonnet-20240620",
			max_tokens: 8000,
			temperature: 0.1,
			top_p: 0.9,
			system: [
				{
					type: "text",
					text: `You're an expert software coder, who specializes in fixing code especially udiffs. You're tasked with fixing a udiff for a file.
				The user will provide you with the original file content and the udiff to fix. Your job is to fix the udiff and provide the fixed udiff content.
				You must only return the fixed udiff content. no other information is needed.
				**PAY attention to the comment and the spacing between the comment and what it's commenting of the file.**
				**ALWAYS** put the comments on top of desired change.
				**ALWAYS** include preexisting comments with correct changes.
				**ALWAYS** Make sure when doing applypatch of the changes with the original file, it will keep correct position.
				**ALWAYS** Include header.
				**REMEMBER** Header lines looks like this --- a/filename for the original state and +++ b/filename for the new state.
				**RETURN** Only the fixed udiff content.
				**NEVER** Add more content to the response more then the fixed udiff content
			

				#Example:
				Original file content:
				public class a {
					def a() {}
				}
				Udiff:
				@ -0,3 +1,4 @@ public class a {
					// Added a new method
					def b() {}
				

				Fixed udiff Response:
				@ -0,3 +0,3 @@ public class a {
					// Added a new method
					def b() {}
				
				`,
				},
			],
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `Here is the original file content: <file>
							<relPath>${relPath}</relPath>
							<content>${fileContent}</content>
							</file>`,
						},
						{
							type: "text",
							text: `here is the udiff to check and fix: <udiff>${udiff}</udiff>`,
						},
						{
							type: "text",
							text: "Please check the udiff and output the fixed udiff content make sure to have the correct line numbers and content",
						},
					],
				},
			],
		}
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

		let finalContent = ""
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
							finalContent =
								eventData.body.anthropic.content[0].type === "text"
									? eventData.body.anthropic.content[0].text
									: ""
							finalResponse = eventData
						} else if (eventData.code === -1) {
							console.error("Network / API ERROR")
							// we should yield the error and not throw it
						}
						console.log("eventData", eventData.body)
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

		return finalContent
	}

	async *createBaseMessageStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		modelId: KoduModelId = this.getModel().id,
		abortSignal?: AbortSignal | null,
		tempature?: number,
		top_p?: number
	): AsyncIterableIterator<koduSSEResponse> {
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
		messages: ApiHistoryItem[],
		creativeMode?: "normal" | "creative" | "deterministic",
		abortSignal?: AbortSignal | null,
		customInstructions?: string,
		userMemory?: string,
		environmentDetails?: string
	): AsyncIterableIterator<koduSSEResponse> {
		const modelId = this.getModel().id
		const isAdvanceThinkingMode = GlobalStateManager.getInstance().getGlobalState("isAdvanceThinkingEnabled")
		const isInlineEditingMode = GlobalStateManager.getInstance().getGlobalState("isInlineEditingEnabled")
		const technicalBackground = GlobalStateManager.getInstance().getGlobalState("technicalBackground")

		const system: Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam[] = []

		// Add system prompt
		system.push({
			text: systemPrompt.trim(),
			type: "text",
		})

		// if it's inline edit we import different prompt
		if (isInlineEditingMode) {
			system.pop()
			const { BASE_SYSTEM_PROMPT } = await import("../agent/v1/prompts/m-11-18-2024.prompt")
			const prompt = await BASE_SYSTEM_PROMPT(
				getCwd(),
				this.getModel().info.supportsImages,
				technicalBackground ?? "developer"
			)
			system.push({
				text: prompt,
				type: "text",
			})
		}

		// Add custom instructions
		if (customInstructions && customInstructions.trim()) {
			system.push({
				text: customInstructions,
				type: "text",
			})
		}
		if (isAdvanceThinkingMode) {
			const { advanceThinkingPrompt } = await import("../agent/v1/prompts/advance-thinking.prompt")
			system.push({
				text: advanceThinkingPrompt,
				type: "text",
			})
		}

		// Mark the last block with cache_control (First Breakpoint)
		system[system.length - 1].cache_control = { type: "ephemeral" }

		// Add environment details
		if (environmentDetails && environmentDetails.trim()) {
			system.push({
				text: environmentDetails,
				type: "text",
				cache_control: { type: "ephemeral" }, // Second Breakpoint
			})
		}

		const userMsgIndices = messages.reduce(
			(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[] as number[]
		)
		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
		// Prepare messages up to the last user message
		const messagesToCache: ApiHistoryItem[] = messages.map((msg, index) => {
			const { ts, ...message } = msg
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

		// randomMaxTokens between 2200 and 3000
		// const rnd = Math.floor(Math.random() * 800) + 2200

		// Build request body
		const requestBody: Anthropic.Beta.PromptCaching.Messages.MessageCreateParamsNonStreaming = {
			model: modelId,
			// max_tokens: 1800,
			max_tokens: this.getModel().info.maxTokens,
			system,
			messages: messagesToCache,
			temperature: 0.1,
			top_p: 0.9,
		}
		this.cancelTokenSource = axios.CancelToken.source()

		const isContinueGenerationEnabled =
			!!GlobalStateManager.getInstance().getGlobalState("isContinueGenerationEnabled")

		const response = await axios.post(
			getKoduInferenceUrl(),
			{
				...requestBody,
			},
			{
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.options.koduApiKey || "",
					"continue-generation": isContinueGenerationEnabled ? "true" : "false",
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

		/* this can be used to enable auto summary quickly */
		// const tokens = estimateTokenCountFromMessages(messages)
		// if (tokens > 80_000) {
		// 	// raise error as max context for testing
		// 	yield {
		// 		code: -1,
		// 		body: {
		// 			msg: "prompt is too long",
		// 			status: 400,
		// 		},
		// 	}
		// }
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
		// randomMaxTokens between 2200 and 3000
		// const rnd = Math.floor(Math.random() * 800) + 2200

		return {
			model: this.getModel().id,
			max_tokens: this.getModel().info.maxTokens,
			// max_tokens: Math.max(rnd, 2200),
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
					"x-api-key": this.options.koduApiKey || "",
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
