import Anthropic from "@anthropic-ai/sdk"
import { ApiHandler } from "."
import { KoduDev } from "../agent/v1"
import { ClaudeMessage } from "../shared/extension-message"
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
	provider: KoduDev,
	history: Anthropic.MessageParam[],
	criticalMsg: string,
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
		await provider.getStateManager().overwriteApiConversationHistory(history)
	}
}

/**
 * Enriches conversation history with environment details and critical messages
 * @param provider - The provider instance
 * @param history - Conversation history to enrich
 * @param isLastMessageFromUser - Whether the last message was from the user
 */
export async function enrichConversationHistory(
	provider: KoduDev,
	history: Anthropic.MessageParam[],
	isLastMessageFromUser: boolean,
	criticalMsg: string
): Promise<void> {
	if (!provider) {
		return
	}

	// Add critical messages every 4th message or the first message
	const userMessageCount = (history.length + 1) / 2
	const shouldAddCriticalMsg = userMessageCount === 1 || userMessageCount % 4 === 0

	const lastMessage = history[history.length - 1]
	const isFirstMessage = history.length === 1

	if (isLastMessageFromUser && Array.isArray(lastMessage.content) && (shouldAddCriticalMsg || isFirstMessage)) {
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
	provider: KoduDev,
	api: ApiHandler,
	currentSystemPrompt: string,
	getApiMetricsFn: (claudeMessages: ClaudeMessage[]) => ApiMetrics,
	logFn: (status: "info" | "debug" | "error", message: string, ...args: any[]) => void
): Promise<"chat_finished" | "compressed"> {
	if (!provider) {
		throw new Error("Provider reference has been garbage collected")
	}
	const history = provider.getStateManager().state.apiConversationHistory || []
	const isAutoSummaryEnabled = provider.getStateManager().autoSummarize ?? false

	if (!isAutoSummaryEnabled) {
		const updatedMessages = truncateHalfConversation(history)
		await provider.getStateManager().overwriteApiConversationHistory(updatedMessages)
		return "compressed"
	}

	const state = await provider.getStateManager().state
	const systemPromptTokens = estimateTokenCount({
		role: "assistant",
		content: [{ type: "text", text: currentSystemPrompt ?? "" }],
	})
	const metrics = getApiMetricsFn(state?.claudeMessages || [])
	const totalTokens =
		metrics.inputTokens +
		metrics.outputTokens +
		metrics.inputCacheWrite +
		metrics.inputCacheRead +
		systemPromptTokens +
		estimateTokenCount(history[history.length - 1])

	const contextWindow = api.getModel().info.contextWindow
	const terminalCompressionThreshold = await provider.getStateManager().state.terminalCompressionThreshold
	const compressedMessages = await smartTruncation(history, api, terminalCompressionThreshold)
	const newMemorySize = compressedMessages.reduce((acc, message) => acc + estimateTokenCount(message), 0)
	logFn("info", `API History before compression:`, history)
	logFn("info", `Total tokens before compression: ${totalTokens}`)
	logFn("info", `Total tokens after compression: ${newMemorySize}`)
	const maxPostTruncationTokens = contextWindow - 13_314 + api.getModel().info.maxTokens
	await provider.getStateManager().overwriteApiConversationHistory(compressedMessages)

	if (newMemorySize >= maxPostTruncationTokens) {
		// reached the end
		// provider?.taskExecutor.say(
		// 	"chat_finished",
		// 	`The chat has reached the maximum token limit. Please create a new task to continue.`
		// )
		// provider.taskExecutor.blockTask()
		return "chat_finished"
	}

	// await provider.taskExecutor.say(
	// 	"chat_truncated",
	// 	JSON.stringify({
	// 		before: totalTokens,
	// 		after: newMemorySize,
	// 	})
	// )
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
