import { Anthropic } from "@anthropic-ai/sdk"
import axios from "axios"
import { ApiConstructorOptions, ApiHandler, ApiHandlerOptions, withoutImageData } from ".."
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
import { ApiHistoryItem } from "../../agent/v1/main-agent"
import { cloneDeep } from "lodash"
import delay from "delay"
import { ModelInfo } from "./types"
import { GlobalStateManager } from "../../providers/state/global-state-manager"
import * as vscode from "vscode"

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
	private _options: ApiConstructorOptions
	private abortController: AbortController | null = null

	get options() {
		return this._options
	}

	constructor(options: ApiConstructorOptions) {
		this._options = options
	}

	async abortRequest(): Promise<void> {
		if (this.abortController) {
			this.abortController.abort("Request aborted by user")
			this.abortController = null
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
		// Configure native thinking for supported models
		const globalStateManager = GlobalStateManager.getInstance()
		let thinkingConfig = undefined
		let usingAnthropicDialect = false

		// Check if we're using the anthropic-json dialect
		const toolParserDialect = (globalStateManager.getGlobalState("toolParserDialect") as string) || "xml"
		usingAnthropicDialect = toolParserDialect === "anthropic-json"

		// Get thinking configuration if model supports it
		// Claude 3.7 Sonnet has native thinking support via Anthropic's API
		if (modelId === "claude-3-7-sonnet-20250219") {
			const thinking = globalStateManager.getGlobalState("thinking")
			if (thinking) {
				// If thinking is enabled, set temperature to 1 (required for thinking)
				tempature = 1
				thinkingConfig = thinking

				// If using anthropic-json dialect, ensure we're properly configured
				if (usingAnthropicDialect) {
					console.log("Using Anthropic JSON dialect with native thinking")
				}
			}
		}
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

		// Build request body with proper configuration for native tool use and thinking
		let requestBody: Anthropic.Beta.PromptCaching.Messages.MessageCreateParamsNonStreaming = {
			model: modelId,
			max_tokens: this.getModel().info.maxTokens,
			system,
			messages: messagesToCache,
			temperature: tempature ?? 0.1,
			top_p: top_p ?? undefined,
			...(thinkingConfig ? { thinking: thinkingConfig } : {}),
		}

		// If using anthropic-json dialect, add tool configuration to the request
		if (usingAnthropicDialect) {
			// Fetch tool definitions from the global state or use defaults
			const toolDefinitions = (globalStateManager.getGlobalState("toolDefinitions") as any[]) || []

			// Only add tools if there are definitions available
			if (toolDefinitions && toolDefinitions.length > 0) {
				requestBody = {
					...requestBody,
					tools: toolDefinitions,
					tool_choice: { type: "auto" }, // Let Claude decide when to use tools
				}
			}
		}
		this.abortController = new AbortController()

		const response = await axios.post(
			getKoduInferenceUrl(),
			{
				...requestBody,
			},
			{
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this._options.providerSettings.apiKey || "",
					"continue-generation": "true",
				},
				responseType: "stream",
				signal: abortSignal ?? this.abortController.signal,
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
						} else if (eventData.code === 1) {
							console.log("Final response received")
							console.log(`final content length: ${eventData.body.anthropic.content.length}`)
							finalResponse = eventData
							// if we hit a stop_sequence, we should yield the stop_sequence before the final response
							if (finalResponse.body.anthropic.stop_reason === "stop_sequence") {
								console.log("Stop sequence reached")
								console.log(`stop_sequence: ${finalResponse.body.anthropic.stop_sequence}`)

								yield {
									code: 2,
									body: {
										text: "</kodu_action>",
									},
								}
								await delay(50)
							}
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
	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this._options.model.id,
			info: this._options.model,
		}
	}
}
