// import { ApiHistoryItem } from "@/agent/v1"
// import { ModelInfo } from "@/shared/api"
// import { ClaudeMessage, isV1ClaudeMessage, V1ClaudeMessage } from "@/shared/extension-message"
// import { isTextBlock } from "@/shared/format-tools"

import { ApiHistoryItem } from "../agent/v1"
import { ModelInfo } from "../shared/api"
import { ClaudeMessage, isV1ClaudeMessage, V1ClaudeMessage } from "../shared/extension-message"
import { isTextBlock } from "../shared/format-tools"

export interface ApiMetrics {
	inputTokens: number
	outputTokens: number
	inputCacheRead: number
	inputCacheWrite: number
	cost: number
}

/**
 * Calculates the API cost based on token usage
 * @param modelInfo - The model info object containing pricing details
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param cacheCreationInputTokens - Number of cache creation tokens
 * @param cacheReadInputTokens - Number of cache read tokens
 * @returns Total API cost
 */
export function calculateApiCost(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens?: number,
	cacheReadInputTokens?: number
): number {
	const cacheWritesCost =
		cacheCreationInputTokens && modelInfo.cacheWritesPrice
			? (modelInfo.cacheWritesPrice / 1_000_000) * cacheCreationInputTokens
			: 0

	const cacheReadsCost =
		cacheReadInputTokens && modelInfo.cacheReadsPrice
			? (modelInfo.cacheReadsPrice / 1_000_000) * cacheReadInputTokens
			: 0

	const baseInputCost = (modelInfo.inputPrice / 1_000_000) * inputTokens
	const outputCost = (modelInfo.outputPrice / 1_000_000) * outputTokens

	return cacheWritesCost + cacheReadsCost + baseInputCost + outputCost
}

/**
 * Cleans up an Anthropic message, removing empty content blocks.
 * @param msg Anthropics message param
 * @returns Cleaned up message or null if empty
 */
export function cleanUpMsg(msg: ApiHistoryItem): ApiHistoryItem | null {
	if (typeof msg.content === "string" && msg.content.trim() === "") {
		return null
	}
	if (Array.isArray(msg.content)) {
		const newContent = msg.content.filter((block) => {
			if (isTextBlock(block)) {
				return block.text.trim() !== ""
			}
			return true
		})
		if (newContent.length === 0) {
			return null
		}
		return { ...msg, content: newContent }
	}
	return msg
}

/**
 * Retrieves and processes API metrics from conversation history
 * @param claudeMessages - Conversation history
 * @returns Processed API metrics
 */
export function getApiMetrics(claudeMessages: ClaudeMessage[]): ApiMetrics {
	const defaultMetrics: ApiMetrics = {
		inputTokens: 0,
		outputTokens: 0,
		inputCacheRead: 0,
		inputCacheWrite: 0,
		cost: 0,
	}

	const lastApiReqFinished = [...claudeMessages].reverse().find((m) => m.say === "api_req_finished")
	if (lastApiReqFinished?.text) {
		const { tokensIn, tokensOut, cacheWrites, cacheReads } = JSON.parse(lastApiReqFinished.text)
		return {
			inputTokens: tokensIn || 0,
			outputTokens: tokensOut || 0,
			inputCacheRead: cacheReads || 0,
			inputCacheWrite: cacheWrites || 0,
			cost: 0,
		}
	}

	const reversedMessages = claudeMessages.slice().reverse()
	const lastV1Message = reversedMessages.find((m) => isV1ClaudeMessage(m) && m?.apiMetrics)
	return (lastV1Message as V1ClaudeMessage)?.apiMetrics || defaultMetrics
}
