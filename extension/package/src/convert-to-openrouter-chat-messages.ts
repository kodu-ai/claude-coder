import type { LanguageModelV1Prompt, LanguageModelV1ProviderMetadata } from "@ai-sdk/provider"
import { convertUint8ArrayToBase64 } from "@ai-sdk/provider-utils"
import type { OpenRouterChatPrompt, ChatCompletionContentPart } from "./openrouter-chat-prompt"

// Type for OpenRouter Cache Control following Anthropic's pattern
export type OpenRouterCacheControl = { type: "ephemeral" }

export function convertToOpenRouterChatMessages(prompt: LanguageModelV1Prompt): OpenRouterChatPrompt {
	const messages: OpenRouterChatPrompt = []

	function getCacheControl(
		providerMetadata: LanguageModelV1ProviderMetadata | undefined
	): OpenRouterCacheControl | undefined {
		const anthropic = providerMetadata?.anthropic

		// Allow both cacheControl and cache_control:
		const cacheControlValue = anthropic?.cacheControl ?? anthropic?.cache_control

		// Return the cache control object if it exists
		return cacheControlValue as OpenRouterCacheControl | undefined
	}

	for (const { role, content, providerMetadata } of prompt) {
		switch (role) {
			case "system": {
				messages.push({
					role: "system",
					content,
					cache_control: getCacheControl(providerMetadata),
				})
				break
			}

			case "user": {
				if (content.length === 1 && content[0]?.type === "text") {
					messages.push({
						role: "user",
						content: content[0].text,
						cache_control:
							getCacheControl(providerMetadata) ?? getCacheControl(content[0].providerMetadata),
					})
					break
				}

				const contentParts: ChatCompletionContentPart[] = content.map((part, index) => {
					// For the last part of a message, check also if the message has cache control
					const isLastPart = index === content.length - 1
					const cacheControl =
						getCacheControl(part.providerMetadata) ??
						(isLastPart ? getCacheControl(providerMetadata) : undefined)

					switch (part.type) {
						case "text":
							return {
								type: "text" as const,
								text: part.text,
								cache_control: cacheControl,
							}
						case "image":
							return {
								type: "image_url" as const,
								image_url: {
									url:
										part.image instanceof URL
											? part.image.toString()
											: `data:${part.mimeType ?? "image/jpeg"};base64,${convertUint8ArrayToBase64(
													part.image
											  )}`,
								},
								cache_control: cacheControl,
							}
						case "file":
							return {
								type: "text" as const,
								text: part.data instanceof URL ? part.data.toString() : part.data,
								cache_control: cacheControl,
							}
						default: {
							const _exhaustiveCheck: never = part
							throw new Error(`Unsupported content part type: ${_exhaustiveCheck}`)
						}
					}
				})

				messages.push({
					role: "user",
					content: contentParts,
					cache_control: getCacheControl(providerMetadata),
				})

				break
			}

			case "assistant": {
				let text = ""
				const toolCalls: Array<{
					id: string
					type: "function"
					function: { name: string; arguments: string }
				}> = []

				for (const part of content) {
					switch (part.type) {
						case "text": {
							text += part.text
							break
						}
						case "tool-call": {
							toolCalls.push({
								id: part.toolCallId,
								type: "function",
								function: {
									name: part.toolName,
									arguments: JSON.stringify(part.args),
								},
							})
							break
						}
						// TODO: Handle reasoning and redacted-reasoning
						case "reasoning":
						case "redacted-reasoning":
							break
						default: {
							const _exhaustiveCheck: never = part
							throw new Error(`Unsupported part: ${_exhaustiveCheck}`)
						}
					}
				}

				messages.push({
					role: "assistant",
					content: text,
					tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
					cache_control: getCacheControl(providerMetadata),
				})

				break
			}

			case "tool": {
				for (const toolResponse of content) {
					messages.push({
						role: "tool",
						tool_call_id: toolResponse.toolCallId,
						content: JSON.stringify(toolResponse.result),
						cache_control:
							getCacheControl(providerMetadata) ?? getCacheControl(toolResponse.providerMetadata),
					})
				}
				break
			}

			default: {
				const _exhaustiveCheck: never = role
				throw new Error(`Unsupported role: ${_exhaustiveCheck}`)
			}
		}
	}

	return messages
}
