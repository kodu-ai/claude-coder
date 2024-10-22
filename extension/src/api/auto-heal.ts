// Import necessary types from the Anthropic SDK
import type { Anthropic } from '@anthropic-ai/sdk'

type PromptCachingBetaMessageParam = Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessageParam
type PromptCachingBetaTextBlockParam = Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam
type PromptCachingBetaImageBlockParam = Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaImageBlockParam
type PromptCachingBetaToolUseBlockParam = Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaToolUseBlockParam
type PromptCachingBetaToolResultBlockParam = Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaToolResultBlockParam

type ContentBlock =
	| PromptCachingBetaTextBlockParam
	| PromptCachingBetaImageBlockParam
	| PromptCachingBetaToolUseBlockParam
	| PromptCachingBetaToolResultBlockParam

// Define the healed message type (same as input for simplicity)
type HealedMessageParam = PromptCachingBetaMessageParam

/**
 * Type guards for content blocks
 */
function isTextBlock(block: ContentBlock): block is PromptCachingBetaTextBlockParam {
	return block.type === 'text' && typeof (block as any).text === 'string'
}

function isImageBlock(block: ContentBlock): block is PromptCachingBetaImageBlockParam {
	return block.type === 'image' && typeof (block as any).source === 'object'
}

function isToolUseBlock(block: ContentBlock): block is PromptCachingBetaToolUseBlockParam {
	return block.type === 'tool_use' && typeof (block as any).id === 'string'
}

function isToolResultBlock(block: ContentBlock): block is PromptCachingBetaToolResultBlockParam {
	return block.type === 'tool_result' && typeof (block as any).tool_use_id === 'string'
}

/**
 * Function to create a placeholder assistant message
 * @returns Placeholder assistant message
 */
function createPlaceholderAssistantMessage(): HealedMessageParam {
	return {
		role: 'assistant',
		content: [
			{
				type: 'text',
				text: 'Placeholder: Assistant was interrupted or did not respond to the last message.',
			} as PromptCachingBetaTextBlockParam,
		],
	}
}

/**
 * Function to heal messages
 * @param messages Array of PromptCachingBetaMessageParam
 * @returns Healed array of PromptCachingBetaMessageParam
 */
function healMessages(messages: PromptCachingBetaMessageParam[]): HealedMessageParam[] {
	const healedMessages: HealedMessageParam[] = []
	let pendingToolUse: { id: string; name: string } | null = null
	let lastProcessedRole: 'user' | 'assistant' | null = null

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]

		// If we encounter consecutive user messages, insert a placeholder assistant message
		if (msg.role === 'user' && lastProcessedRole === 'user') {
			healedMessages.push(createPlaceholderAssistantMessage())
		}

		// If there's a pending tool_use, ensure the current user message contains tool_result
		if (msg.role === 'user' && pendingToolUse?.id) {
			const toolUseId: string = pendingToolUse.id
			let hasToolResult = false

			if (typeof msg.content === 'string') {
				// If content is a string, replace it with an array containing the string and the missing tool_result
				msg.content = [
					{ type: 'text', text: msg.content } as PromptCachingBetaTextBlockParam,
					{
						type: 'tool_result',
						tool_use_id: toolUseId,
						content: 'Placeholder: tool_result missing or user did not respond.',
					} as PromptCachingBetaToolResultBlockParam,
				]
				hasToolResult = true
			} else if (Array.isArray(msg.content)) {
				// Check if any content block is a tool_result with matching tool_use_id
				for (const block of msg.content) {
					if (isToolResultBlock(block) && block.tool_use_id === toolUseId) {
						hasToolResult = true
						break
					}
				}

				// If not found, append a placeholder tool_result
				if (!hasToolResult) {
					msg.content = [
						...msg.content,
						{
							type: 'tool_result',
							tool_use_id: toolUseId,
							content: 'Placeholder: tool_result missing or user did not respond.',
						} as PromptCachingBetaToolResultBlockParam,
					]
				}
			}

			// Reset pendingToolUse after handling
			pendingToolUse = null
		}

		// Process the message content to handle tool_use blocks
		if (msg.role === 'assistant' && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (isToolUseBlock(block)) {
					// Set pendingToolUse to expect a tool_result in the next user message
					pendingToolUse = { id: block.id, name: block.name }
					break // Assuming one tool_use per assistant message
				}
			}
		}

		// Append the healed message
		healedMessages.push(msg)

		// Update lastProcessedRole
		lastProcessedRole = msg.role
	}

	// After processing all messages, ensure the last message is from user
	if (healedMessages.length > 0 && healedMessages[healedMessages.length - 1].role !== 'user') {
		// Add a placeholder user message instead of removing the last assistant message
		const placeholderUserMessage: HealedMessageParam = {
			role: 'user',
			content: [
				{
					type: 'text',
					text: 'Placeholder: Assistant was interrupted or did not respond to the last message.',
				} as PromptCachingBetaTextBlockParam,
			],
		}
		healedMessages.push(placeholderUserMessage)
	}

	// If there's a pending tool_use after all messages, append a placeholder tool_result
	if (pendingToolUse) {
		const placeholderMessage: HealedMessageParam = {
			role: 'user',
			content: [
				{
					type: 'tool_result',
					tool_use_id: pendingToolUse.id,
					content: 'Placeholder: tool_result missing or user did not respond.',
				} as PromptCachingBetaToolResultBlockParam,
			],
		}
		healedMessages.push(placeholderMessage)
	}

	// order heal messages that tool_use and tool_result are first
	const orderedHeal = healedMessages.map((msg) => {
		// array of content blocks must have tool_use or tool_result first
		const content = msg.content
		if (Array.isArray(content)) {
			// sort content blocks
			content.sort((a, b) => {
				if (isToolUseBlock(a)) {
					return -1
				}
				if (isToolResultBlock(a)) {
					return -1
				}
				if (isToolUseBlock(b)) {
					return 1
				}
				if (isToolResultBlock(b)) {
					return 1
				}
				return 0
			})
		}
		return msg
	})
	return orderedHeal
}

export { healMessages }
