import { Anthropic } from "@anthropic-ai/sdk"
import axios, { CancelTokenSource } from "axios"
import * as vscode from "vscode"
import { z } from "zod"
import { ApiHandler, ApiHandlerMessageResponse, withoutImageData } from "."
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
import { healMessages } from "./auto-heal"
import { AskConsultantResponseDto, SummaryResponseDto, WebSearchResponseDto } from "./interfaces"
import { USER_TASK_HISTORY_PROMPT } from "../agent/v1/system-prompt"
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
		customInstructions?: string,
		userMemory?: string,
		environmentDetails?: string
	): AsyncIterableIterator<koduSSEResponse> {
		const modelId = this.getModel().id
		let requestBody: Anthropic.Beta.PromptCaching.Messages.MessageCreateParamsNonStreaming
		console.log(`creativeMode: ${creativeMode}`)
		const creativitySettings = temperatures[creativeMode ?? "normal"]
		// check if the root of the folder has .kodu file if so read the content and use it as the system prompt
		let dotKoduFileContent = ""
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders) {
			for (const folder of workspaceFolders) {
				const dotKoduFile = vscode.Uri.joinPath(folder.uri, ".kodu")
				try {
					const fileContent = await vscode.workspace.fs.readFile(dotKoduFile)
					dotKoduFileContent = Buffer.from(fileContent).toString("utf8")
					console.log(".kodu file content:", dotKoduFileContent)
					break // Exit the loop after finding and reading the first .kodu file
				} catch (error) {
					console.log(`No .kodu file found in ${folder.uri.fsPath}`)
				}
			}
		}
		const system: Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam[] = [
			{ text: systemPrompt.trim(), type: "text" },
		]
		if (previousSystemPrompt !== systemPrompt) {
			console.error("System prompt changed")
			console.error("Previous system prompt:", previousSystemPrompt)
			console.error("Current system prompt:", systemPrompt)
			console.error(`Length difference: ${previousSystemPrompt.length - systemPrompt.length}`)
		}
		previousSystemPrompt = systemPrompt
		if (customInstructions && customInstructions.trim()) {
			system.push({
				text: customInstructions,
				type: "text",
				cache_control: { type: "ephemeral" },
			})
		} else {
			system[0].cache_control = { type: "ephemeral" }
		}
		system.push({
			cache_control: {
				type: "ephemeral",
			},
			text: environmentDetails ?? "No environment details provided",
			type: "text",
		})

		// every 4 messages, we should add a critical message to the last user message and on the first user message
		const lengthDivdedByFour = messages.length % 4 === 0 || messages.length === 1

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
					system,
					messages: healMessages(messages).map((message, index) => {
						if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
							if (index === lastUserMsgIndex && lengthDivdedByFour) {
								const criticalMsg = `<most_important_context>
								If you want to run a server, you must use the server_runner_tool tool, do not use the execute_command tool to start a server.
								SUPER CRITICAL YOU MUST NEVER FORGET THIS:
								You shouldn't never call read_file again, unless you don't have the content of the file in the conversation history, if you called write_to_file, the content you sent in <write_to_file> is the latest, you should never call read_file again unless the content is gone from the conversation history.
								- Before writing to a file you must first write the following questions and answers:
								- Did i read the file before writing to it? (yes/no)
								- Did i write to the file before? (yes/no)
								- Did the user provide the content of the file? (yes/no)
								- Do i have the last content of the file either from the user or from a previous read_file tool use or from write_to_file tool? Yes write_to_file | Yes read_file | Yes user provided | No i don't have the last content of the file
								
								Think about in your <thinking> tags and ask yourself the question: "Do I really need to read the file again?".
								SUPER SUPER CRITICAL:
								You should never truncate the content of a file, always return the complete content of the file in your, even if you didn't modify it.
								</most_important_context>`
								if (typeof message.content === "string") {
									// add environment details to the last user message
									return {
										...message,
										content: [
											{
												text: criticalMsg,
												type: "text",
											},
											{
												text: message.content,
												type: "text",
												cache_control: { type: "ephemeral" },
											},
										],
									}
								} else {
									message.content.push({
										text: criticalMsg,
										type: "text",
									})
								}
							}
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
					...creativitySettings,
					// temperature: 0,
				}
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
