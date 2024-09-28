export type TaskCompleteEventParams = {
	taskId: string
	totalCost: number
	totalCacheReadTokens: number
	totalCacheWriteTokens: number
	totalOutputTokens: number
	totalInputTokens: number
}

export type TaskRequestEventParams = {
	taskId: string
	model: string
	apiCost: number
	inputTokens: number
	cacheReadTokens: number
	cacheWriteTokens: number
	outputTokens: number
}
