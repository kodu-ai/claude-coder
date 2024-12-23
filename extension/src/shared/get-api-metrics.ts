import { ClaudeMessage, isV1ClaudeMessage } from "./extension-message"

interface ApiMetrics {
	totalTokensIn: number
	totalTokensOut: number
	totalCacheWrites?: number
	totalCacheReads?: number
	totalCost: number
}

export function getApiMetrics(messages: ClaudeMessage[]): ApiMetrics {
	const result: ApiMetrics = {
		totalTokensIn: 0,
		totalTokensOut: 0,
		totalCacheWrites: undefined,
		totalCacheReads: undefined,
		totalCost: 0,
	}

	for (const message of messages) {
		if (isV1ClaudeMessage(message)) {
			result.totalTokensIn += message.apiMetrics?.inputTokens ?? 0
			result.totalTokensOut += message.apiMetrics?.outputTokens ?? 0
			result.totalCacheWrites = (result.totalCacheWrites ?? 0) + (message.apiMetrics?.inputCacheWrite ?? 0)
			result.totalCacheReads = (result.totalCacheReads ?? 0) + (message.apiMetrics?.inputCacheRead ?? 0)
			result.totalCost += message.apiMetrics?.cost ?? 0
		}
	}

	return result
}
