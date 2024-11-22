import { Anthropic } from "@anthropic-ai/sdk"

// Constants for better maintainability
const MIN_MESSAGES_TO_KEEP = 4
const RECENT_MESSAGES_TO_PRESERVE = 8
const IMAGE_TOKEN_ESTIMATE = 2000
const CHARS_PER_TOKEN_ESTIMATE = 3

export const isTextBlock = (block: any): block is Anthropic.TextBlockParam => {
	if (!block || typeof block !== "object") return false
	return block.type === "text"
}

export const isImageBlock = (block: any): block is Anthropic.ImageBlockParam => {
	if (!block || typeof block !== "object") return false
	return block.type === "image"
}

/*
We can't implement a dynamically updating sliding window as it would break prompt cache
every time. To maintain the benefits of caching, we need to keep conversation history
static. This operation should be performed as infrequently as possible. If a user reaches
a 200k context, we can assume that the first half is likely irrelevant to their current task.
Therefore, this function should only be called when absolutely necessary to fit within
context limits, not as a continuous process.
*/
export function truncateHalfConversation(
	messages: Anthropic.Messages.MessageParam[]
): Anthropic.Messages.MessageParam[] {
	if (!Array.isArray(messages) || messages.length < MIN_MESSAGES_TO_KEEP) {
		return messages
	}

	// Always keep the first Task message (this includes the project's file structure in potentially_relevant_details)
	const firstMessage = messages[0]

	// Calculate how many message pairs to remove (must be even to maintain user-assistant order)
	const messagePairsToRemove = Math.max(1, Math.floor((messages.length - MIN_MESSAGES_TO_KEEP) / 4)) * 2

	// Keep the first message and the remaining messages after truncation
	const remainingMessages = messages.slice(messagePairsToRemove + 1)

	// check if the first message exists appx twice if so pop the last instance and insert the first message again as last
	// if it doesn't exist twice, insert the first message as the last message

	return [firstMessage, ...remainingMessages]
}

/**
 * Truncates tool calls except for the most recent messages
 * @param messages Array of message parameters
 * @returns Compressed messages array
 */
export function smartTruncation(messages: Anthropic.Messages.MessageParam[]): Anthropic.Messages.MessageParam[] {
	if (!Array.isArray(messages) || messages.length === 0) {
		return messages
	}

	return messages.map((msg, index) => {
		if (index >= messages.length - RECENT_MESSAGES_TO_PRESERVE) {
			return msg
		}

		// Handle message content
		if (!msg.content) {
			return msg
		}

		// If content is a string, wrap it in a text block
		if (typeof msg.content === "string") {
			return {
				...msg,
				content: [
					{
						type: "text",
						text: msg.content,
					},
				],
			}
		}

		// If content is an array, process each block
		if (Array.isArray(msg.content)) {
			// @ts-expect-error - correctly infers that msg is a MessageParam
			const truncatedContent = compressToolFromMsg(msg.content)
			// Only update if truncation produced different content
			if (truncatedContent.length > 0) {
				return {
					...msg,
					content: truncatedContent,
				}
			}
		}

		return msg
	})
}

/**
 * Estimates token count from a message using character-based heuristics
 * @param message - The message to analyze
 * @returns Estimated token count
 */
export const estimateTokenCount = (message: Anthropic.MessageParam): number => {
	try {
		if (!message.content) return 0

		if (typeof message.content === "string") {
			return Math.ceil(message.content.length / CHARS_PER_TOKEN_ESTIMATE)
		}

		if (!Array.isArray(message.content)) {
			return 0
		}

		const textContent = message.content
			.filter((block) => isTextBlock(block))
			.map((block) => (block as Anthropic.TextBlockParam).text)
			.join("")

		const textTokens = Math.ceil(textContent.length / CHARS_PER_TOKEN_ESTIMATE)
		const imageCount = message.content.filter((block) => isImageBlock(block)).length
		const imageTokens = imageCount * IMAGE_TOKEN_ESTIMATE

		return textTokens + imageTokens
	} catch (error) {
		console.error("Error estimating token count:", error)
		return 0
	}
}

/**
 * Estimates total token count from an array of messages
 * @param messages Array of messages to estimate tokens for
 * @returns Total estimated token count
 */
export const estimateTokenCountFromMessages = (messages: Anthropic.Messages.MessageParam[]): number => {
	if (!Array.isArray(messages)) return 0

	return messages.reduce((acc, message) => acc + estimateTokenCount(message), 0)
}
