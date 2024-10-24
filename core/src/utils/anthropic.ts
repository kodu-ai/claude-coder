import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Format images into Anthropic image blocks
 * @param images - Array of image data URLs
 * @returns Array of Anthropic image blocks
 */
export function formatImagesIntoBlocks(images?: string[]): Anthropic.ImageBlockParam[] {
	return images
		? images.map((dataUrl) => {
				const [rest, base64] = dataUrl.split(",")
				const mimeType = rest.split(":")[1].split(";")[0]
				return {
					type: "image",
					source: { type: "base64", media_type: mimeType, data: base64 },
				} as Anthropic.ImageBlockParam
		  })
		: []
}

export function formatToolResponse(
	text: string,
	images?: string[]
): string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
	if (images && images.length > 0) {
		const textBlock: Anthropic.TextBlockParam = { type: "text", text }
		const imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
		return [textBlock, ...imageBlocks]
	} else {
		return text
	}
}

export function withoutImageData(
	userContent: Array<
		Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
	>
): Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
> {
	return userContent.map((part) => {
		if (part.type === "image") {
			return { ...part, source: { ...part.source, data: "..." } }
		} else if (part.type === "tool_result" && typeof part.content !== "string") {
			return {
				...part,
				content: part.content?.map((contentPart) => {
					if (contentPart.type === "image") {
						return { ...contentPart, source: { ...contentPart.source, data: "..." } }
					}
					return contentPart
				}),
			}
		}
		return part
	})
}

/**
 *
 * @description every 3 letters are on avg 1 token, image is about 2000 tokens
 * @param message the last message
 * @returns the tokens from the message
 */
export const anthropicMessageToTokens = (message: Anthropic.MessageParam) => {
	const content = message.content
	if (typeof content === "string") {
		return Math.round(content.length / 2)
	}
	const textBlocks = content.filter((block) => block.type === "text")
	const text = textBlocks.map((block) => block.text).join("")
	const textTokens = Math.round(text.length / 3)
	const imgBlocks = content.filter((block) => block.type === "image")
	const imgTokens = imgBlocks.length * 2000
	return Math.round(textTokens + imgTokens)
}
