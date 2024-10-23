import { ClaudeAsk, ClaudeSay } from "./task-communication"
import { ToolStatus } from "./tools"

export type V0ClaudeMessage = {
	ts: number
	type: "ask" | "say"
	ask?: ClaudeAsk
	say?: ClaudeSay
	text?: string
	images?: string[]
	/**
	 * If true, the ask will be automatically approved but the message will still be shown to the user as if it was a normal message
	 */
	autoApproved?: boolean
}

export type V1ClaudeMessage = {
	/**
	 * the version of the message format
	 */
	v: 1
	/**
	 *
	 */
	isAborted?: "user" | "timeout"
	isError?: boolean
	isFetching?: boolean
	isExecutingCommand?: boolean
	errorText?: string
	retryCount?: number
	status?: ToolStatus
	isDone?: boolean
	modelId?: string
	apiMetrics?: {
		cost: number
		inputTokens: number
		outputTokens: number
		inputCacheRead: number
		inputCacheWrite: number
	}
	// other flags
} & V0ClaudeMessage

export type ClaudeMessage = V1ClaudeMessage | V0ClaudeMessage
