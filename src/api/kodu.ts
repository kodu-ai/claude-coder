import { Anthropic } from "@anthropic-ai/sdk"
import axios, { CancelTokenSource } from "axios"
import { ApiHandler, ApiHandlerMessageResponse, withoutImageData } from "."
import { ApiHandlerOptions, koduDefaultModelId, KoduModelId, koduModels, ModelInfo } from "../shared/api"
import {
	getKoduCurrentUser,
	getKoduInferenceUrl,
	KODU_ERROR_CODES,
	KoduError,
	koduErrorMessages,
	koduSSEResponse,
} from "../shared/kodu"

const temperatures = {
	creative: {
		top_p: 0.8,
		tempature: 0.2,
	},
	normal: {},
	deterministic: {
		top_p: 0.9,
		tempature: 0.1,
	},
} as const

export async function fetchKoduUser({ apiKey }: { apiKey: string }) {
	console.log(`fetchKoduUser: ${getKoduCurrentUser()}`)
	const response = await axios.get(getKoduCurrentUser(), {
		headers: {
			"x-api-key": apiKey,
		},
	})
	console.log("response", response)
	if (response.data) {
		return {
			credits: Number(response.data.credits) ?? 0,
			id: response.data.id as string,
			email: response.data.email as string,
		}
	}
	return null
}

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

	async createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		tools: Anthropic.Messages.Tool[],
		creativeMode: "normal" | "creative" | "deterministic"
	): Promise<ApiHandlerMessageResponse> {
		const modelId = this.getModel().id
		let requestBody: Anthropic.Beta.PromptCaching.Messages.MessageCreateParamsNonStreaming
		console.log(`creativeMode: ${creativeMode}`)
		const creativitySettings = temperatures[creativeMode]

		switch (modelId) {
			case "claude-3-5-sonnet-20240620":
			case "claude-3-opus-20240229":
			case "claude-3-haiku-20240307":
				console.log("Matched anthropic cache model")
				const userMsgIndices = messages.reduce(
					(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
					[] as number[]
				)
				/**
				 * tools seems to be cached with the system prompt, so maybe we don't need to add duplicate cache control
				 */
				const toolsWithCacheControl = tools.map((tool, index) => ({
					...tool,
					// last index requires cache control
					...(index === tools.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
				}))
				const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
				const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
				requestBody = {
					model: modelId,
					max_tokens: this.getModel().info.maxTokens,
					system: [{ text: systemPrompt, type: "text", cache_control: { type: "ephemeral" } }],
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
					tools,
					tool_choice: { type: "auto" },
				}
				break
			default:
				console.log("Matched default model")
				requestBody = {
					model: modelId,
					max_tokens: this.getModel().info.maxTokens,
					system: [{ text: systemPrompt, type: "text" }],
					messages,
					tools,
					tool_choice: { type: "auto" },
					...creativitySettings,
				}
		}
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(getKoduInferenceUrl(), requestBody, {
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.options.koduApiKey || "",
			},
			responseType: "stream",
			cancelToken: this.cancelTokenSource.token,
		})

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
			let finalResponse: any = null
			let buffer = ""

			for await (const chunk of reader) {
				buffer += decoder.decode(chunk, { stream: true })
				const lines = buffer.split("\n\n")
				buffer = lines.pop() || ""

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const eventData = JSON.parse(line.slice(6)) as koduSSEResponse

						console.log("eventData", eventData)

						if (eventData.code === 0) {
							console.log("Health check received")
						} else if (eventData.code === 1) {
							finalResponse = eventData.body
							console.log("finalResponse", finalResponse)
							break
						} else if (eventData.code === -1) {
							throw new KoduError({
								code: eventData.body.status ?? KODU_ERROR_CODES.API_ERROR,
							})
						}
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

			const message: {
				anthropic: Anthropic.Messages.Message
				internal: {
					userCredits: number
				}
			} = finalResponse
			return {
				message: message.anthropic,
				userCredits: message.internal?.userCredits,
			}
		} else {
			throw new Error("No response data received")
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
		return {
			model: this.getModel().id,
			max_tokens: this.getModel().info.maxTokens,
			system: "(see SYSTEM_PROMPT in src/ClaudeDev.ts)",
			messages: [{ conversation_history: "..." }, { role: "user", content: withoutImageData(userContent) }],
			tools: "(see tools in src/ClaudeDev.ts)",
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
}
