import { Anthropic } from "@anthropic-ai/sdk"
import { CoreMessage, UserContent } from "ai"

export function convertToAISDKFormat(anthropicMessages: Anthropic.Messages.MessageParam[]): CoreMessage[] {
	const openAiMessages: CoreMessage[] = []

	for (const anthropicMessage of anthropicMessages) {
		if (typeof anthropicMessage.content === "string") {
			openAiMessages.push({ role: anthropicMessage.role, content: anthropicMessage.content })
		} else {
			if (anthropicMessage.role === "user") {
				const { content } = anthropicMessage.content.reduce<{
					content: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
				}>(
					(acc, part) => {
						if (part.type === "tool_result") {
							// user cannot send tool_result messages
							return acc
						} else if (part.type === "text" || part.type === "image") {
							acc.content.push(part)
						} // user cannot send tool_use messages
						return acc
					},
					{ content: [] }
				)

				// Process non-tool messages
				if (content.length > 0) {
					openAiMessages.push({
						role: "user",
						content: content.map((part) => {
							if (part.type === "image") {
								const content: UserContent[0] = {
									type: "image",
									image: `data:${part.source.media_type};base64,${part.source.data}`,
								}
								return content
							}
							return { type: "text", text: part.text }
						}),
					})
				}
			} else if (anthropicMessage.role === "assistant") {
				const { msgContent } = anthropicMessage.content.reduce<{
					msgContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
				}>(
					(acc, part) => {
						if (part.type === "tool_use") {
							return acc
						} else if (part.type === "text" || part.type === "image") {
							acc.msgContent.push(part)
						} // assistant cannot send tool_result messages
						return acc
					},
					{ msgContent: [] }
				)

				// Process non-tool messages FIRST
				let content: string = ""
				if (msgContent.length > 0) {
					content = msgContent
						.map((part) => {
							if (part.type === "image") {
								return "" // impossible as the assistant cannot send images
							}
							return part.text
						})
						.join("\n")
				}

				openAiMessages.push({
					role: "assistant",
					content,
				})
			}
		}
	}

	return openAiMessages
}
