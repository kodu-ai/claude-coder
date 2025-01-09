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
	provider: "kodu" | "custom"
}

export enum AmplitudeMetrics {
	GLOBAL_TASK_REQUEST_COUNT = "metrics.global_task_request_count",
}
