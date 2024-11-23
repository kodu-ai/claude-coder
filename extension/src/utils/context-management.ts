import { Anthropic } from "@anthropic-ai/sdk"
import { compressToolFromMsg } from "../shared/format-tools"

// Constants for better maintainability
const MIN_MESSAGES_TO_KEEP = 4
const BASE_MESSAGES_TO_PRESERVE = 8
const IMAGE_TOKEN_ESTIMATE = 2000
const CHARS_PER_TOKEN_ESTIMATE = 3
const TOKEN_THRESHOLD_FOR_COMPRESSION = 100000 // Start compressing at 100k tokens
const MAX_PRESERVED_MESSAGES = 12

export const isTextBlock = (block: any): block is Anthropic.TextBlockParam => {
	if (!block || typeof block !== "object") return false
	return block.type === "text"
}

export const isImageBlock = (block: any): block is Anthropic.ImageBlockParam => {
	if (!block || typeof block !== "object") return false
	return block.type === "image"
}

/**
 * Dynamically determines how many recent messages to preserve based on context size
 * @param totalTokens Current total token count
 * @returns Number of messages to preserve
 */
function getDynamicPreserveCount(totalTokens: number): number {
	if (totalTokens > 150000) return Math.max(MIN_MESSAGES_TO_KEEP, Math.floor(BASE_MESSAGES_TO_PRESERVE * 0.5));
	if (totalTokens > 100000) return Math.max(MIN_MESSAGES_TO_KEEP, Math.floor(BASE_MESSAGES_TO_PRESERVE * 0.75));
	return Math.min(MAX_PRESERVED_MESSAGES, BASE_MESSAGES_TO_PRESERVE);
}

/**
 * Proactively compresses context when approaching token limits
 * @param messages Array of messages to compress
 * @param totalTokens Current total token count
 * @returns Compressed messages array
 */
export function proactiveCompression(
	messages: Anthropic.Messages.MessageParam(),
	totalTokens: number
): Anthropic.Messages.MessageParam[] {
	if (!Array.isArray(messages) || messages.length === 0 || totalTokens < TOKEN_THRESHOLD_FOR_COMPRESSION) {
		return messages;
	}

	const preserveCount = getDynamicPreserveCount(totalTokens);
	const compressionRatio = Math.min(1, TOKEN_THRESHOLD_FOR_COMPRESSION / totalTokens);

	return messages.map((msg, index) => {
		// Always preserve the first message and recent messages
		if (index === 0 || index >= messages.length - preserveCount) {
			return msg;
		}

		// Progressive compression based on message position and token count
		const positionRatio = index / messages.length;
		const shouldCompress = Math.random() < (1 - compressionRatio) * positionRatio;

		if (shouldCompress && msg.content) {
			if (typeof msg.content === "string") {
				return {
					...msg,
					content: [{ type: "text", text: msg.content }],
				};
			}

			if (Array.isArray(msg.content)) {
				const truncatedContent = compressToolFromMsg(msg.content);
				if (truncatedContent.length > 0) {
					return {
						...msg,
						content: truncatedContent,
					};
				}
			}
		}

		return msg;
	});
}

/**
 * Truncates tool calls except for the most recent messages
 * @param messages Array of message parameters
 * @returns Compressed messages array
 */
export function smartTruncation(messages: Anthropic.Messages.MessageParam[]): Anthropic.Messages.MessageParam[] {
	if (!Array.isArray(messages) || messages.length === 0) {
		return messages;
	}

	return messages.map((msg, index) => {
		if (index >= messages.length - BASE_MESSAGES_TO_PRESERVE) {
			return msg;
		}

		// Handle message content
		if (!msg.content) {
			return msg;
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
			};
		}

		// If content is an array, process each block
		if (Array.isArray(msg.content)) {
			// @ts-expect-error - correctly infers that msg is a MessageParam
			const truncatedContent = compressToolFromMsg(msg.content);
			// Only update if truncation produced different content
			if (truncatedContent.length > 0) {
				return {
					...msg,
					content: truncatedContent,
				};
			}
		}

		return msg;
	});
}

/**
 * Estimates token count from a message using character-based heuristics
 * @param message - The message to analyze
 * @returns Estimated token count
 */
export const estimateTokenCount = (message: Anthropic.MessageParam): number => {
	try {
		if (!message.content) return 0;

		if (typeof message.content === "string") {
			return Math.ceil(message.content.length / CHARS_PER_TOKEN_ESTIMATE);
		}

		if (!Array.isArray(message.content)) {
			return 0;
		}

		const textContent = message.content
			.filter((block) => isTextBlock(block))
			.map((block) => (block as Anthropic.TextBlockParam).text)
			.join("");

		const textTokens = Math.ceil(textContent.length / CHARS_PER_TOKEN_ESTIMATE);
		const imageCount = message.content.filter((block) => isImageBlock(block)).length;
		const imageTokens = imageCount * IMAGE_TOKEN_ESTIMATE;

		return textTokens + imageTokens;
	} catch (error) {
		console.error("Error estimating token count:", error);
		return 0;
	}
};

/**
 * Estimates total token count from an array of messages
 * @param messages Array of messages to estimate tokens for
 * @returns Total estimated token count
 */
export const estimateTokenCountFromMessages = (messages: Anthropic.Messages.MessageParam[]): number => {
	if (!Array.isArray(messages)) return 0;

	return messages.reduce((acc, message) => acc + estimateTokenCount(message), 0);
};

/**
 * Truncates half conversation
 * @param messages Array of message parameters
 * @returns Truncated messages array
 */
export function truncateHalfConversation(
	messages: Anthropic.Messages.MessageParam[]
): Anthropic.Messages.MessageParam[] {
	if (!Array.isArray(messages) || messages.length < MIN_MESSAGES_TO_KEEP) {
		return messages;
	}

	// Always keep the first Task message (this includes the project's file structure in potentially_relevant_details)
	const firstMessage = messages[0];

	// Calculate how many message pairs to remove (must be even to maintain user-assistant order)
	const messagePairsToRemove = Math.max(1, Math.floor((messages.length - MIN_MESSAGES_TO_KEEP) / 4)) * 2;

	// Keep the first message and the remaining messages after truncation
	const remainingMessages = messages.slice(messagePairsToRemove + 1);

	return [firstMessage, ...remainingMessages];
}
