import Anthropic from "@anthropic-ai/sdk"
import { ApiHandler } from "."
import { MainAgent } from "../agent/v1/main-agent"
import { ClaudeMessage } from "../shared/messages/extension-message"
import { isTextBlock } from "../shared/format-tools"
import { truncateHalfConversation, estimateTokenCount, smartTruncation } from "../utils/context-managment"
import { cleanUpMsg, ApiMetrics } from "./api-utils"

/**
 * @danger This function is mutating the history object
 * Processes the conversation history and manages context window
 * @param provider - The provider instance
 * @param history - Conversation history to process, this will be mutated.
 * @mutates history to add critical messages and environment details to the last message
 */
export async function processConversationHistory(
	provider: MainAgent,
	history: Anthropic.MessageParam[],
	criticalMsg?: string,
	/**
	 * Whether to save the conversation to state and disk after processing
	 */
	autoSaveToDisk = false
): Promise<void> {
	if (!provider) {
		return
	}
	// Ensure the conversation history starts with a USER > ASSISTANT > USER pattern
	ensureLastMessageFromUser(history)

	const lastMessage = history[history.length - 1]
	const isLastMessageFromUser = lastMessage?.role === "user"

	// Convert string content to structured content if needed
	if (typeof lastMessage?.content === "string") {
		lastMessage.content = [
			{
				type: "text",
				text: lastMessage.content,
			},
		]
	}

	// Cleanup last message
	const cleanedLastMessage = cleanUpMsg(lastMessage)
	if (cleanedLastMessage === null) {
		lastMessage.content = [
			{
				type: "text",
				text: "Please continue the conversation.",
			},
		]
		history[history.length - 1] = lastMessage
	} else {
		history[history.length - 1] = cleanedLastMessage
	}

	// Enrich conversation history with environment details and critical messages
	await enrichConversationHistory(provider, history, isLastMessageFromUser, criticalMsg)

	if (autoSaveToDisk) {
		await provider.getStateManager().apiHistoryManager.overwriteApiConversationHistory(history)
	}
}

/**
 * Enriches conversation history with environment details and critical messages
 * @param provider - The provider instance
 * @param history - Conversation history to enrich
 * @param isLastMessageFromUser - Whether the last message was from the user
 */
export async function enrichConversationHistory(
	provider: MainAgent,
	history: Anthropic.MessageParam[],
	isLastMessageFromUser: boolean,
	criticalMsg?: string
): Promise<void> {
	if (!provider) {
		return
	}

	// Add critical messages every 8th message or the first message
	const userMessageCount = (history.length + 1) / 2
	const shouldAddCriticalMsg = userMessageCount === 1 || userMessageCount % 8 === 0

	const lastMessage = history[history.length - 1]
	const isFirstMessage = history.length === 1

	if (
		isLastMessageFromUser &&
		Array.isArray(lastMessage.content) &&
		(shouldAddCriticalMsg || isFirstMessage) &&
		criticalMsg
	) {
		lastMessage.content.push({
			type: "text",
			text: criticalMsg,
		})
	}

	const environmentDetails = await provider.getEnvironmentDetails(isFirstMessage)

	if (Array.isArray(lastMessage.content) && environmentDetails && isLastMessageFromUser) {
		const hasEnvDetails = lastMessage.content.some(
			(block) =>
				isTextBlock(block) &&
				block.text.includes("<environment_details>") &&
				block.text.includes("</environment_details>")
		)

		if (!hasEnvDetails) {
			lastMessage.content.push({
				type: "text",
				text: environmentDetails,
			})
		}
	}

	// now we want to reverse of the content so the first content is the last message (gives it better attention)
	if (Array.isArray(lastMessage.content)) {
		lastMessage.content.reverse()
	}
}

/**
 * Manages the context window to prevent token overflow
 * @param provider - The provider instance
 * @param api - The api handler instance
 * @param currentSystemPrompt - The current system prompt string
 * @param getApiMetricsFn - Function to get API metrics
 * @param logFn - Logging function
 * @returns "chat_finished" or "compressed"
 */
export async function manageContextWindow(
	provider: MainAgent,
	api: ApiHandler,
	logFn: (status: "info" | "debug" | "error", message: string, ...args: any[]) => void
): Promise<"chat_finished" | "compressed"> {
	if (!provider) {
		throw new Error("Provider reference has been garbage collected")
	}
	const history = provider.getStateManager().state.apiConversationHistory || []
	const isAutoSummaryEnabled = provider.getStateManager().autoSummarize ?? false

	if (!isAutoSummaryEnabled) {
		const updatedMessages = truncateHalfConversation(history)
		await provider.getStateManager().apiHistoryManager.overwriteApiConversationHistory(updatedMessages)
		return "compressed"
	}

	const contextWindow = api.getModel().info.contextWindow
	const terminalCompressionThreshold = await provider.getStateManager().state.terminalCompressionThreshold
	const compressedMessages = await smartTruncation(history, api, terminalCompressionThreshold)
	const newMemorySize = compressedMessages.reduce((acc, message) => acc + estimateTokenCount(message), 0)
	logFn("info", `API History before compression:`, history)
	logFn("info", `Total tokens after compression: ${newMemorySize}`)
	const maxPostTruncationTokens = contextWindow - 13_314 + api.getModel().info.maxTokens
	await provider.getStateManager().apiHistoryManager.overwriteApiConversationHistory(compressedMessages)

	if (newMemorySize >= maxPostTruncationTokens) {
		console.error(`We have reached the maximum token limit: ${newMemorySize}`)
		// reached the end
		provider?.taskExecutor.say("chat_finished", undefined, undefined, undefined, {
			isSubMessage: true,
		})
		provider.taskExecutor.blockTask()
		return "chat_finished"
	}

	await provider.taskExecutor.say("chat_truncated", undefined, undefined, undefined, {
		isSubMessage: true,
	})
	return "compressed"
}

function ensureLastMessageFromUser(history: Anthropic.MessageParam[]) {
	// check if the conversation includes user messages
	const hasUserMessage = history.some((message) => message.role === "user")
	if (!hasUserMessage) {
		throw new Error("Conversation history must include at least one user message")
	}
	// checks if the last message if from the user
	const lastMessage = history[history.length - 1]
	if (lastMessage.role === "assistant") {
		// we are going to remove the assistant reply
		history.pop()
		// now we check if the following message is from the user or assistant
		const nextMessage = history[history.length - 1]
		if (nextMessage.role === "assistant") {
			// this should never happen so we throw an error
			throw new Error("Conversation history must be in the USER > ASSISTANT > USER pattern")
		}
	}
}
