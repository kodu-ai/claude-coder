export interface ClaudeRequestResult {
	didEndLoop: boolean
	inputTokens: number
	outputTokens: number
}

export interface ClaudeRequestResultV1 {
	didEndLoop: boolean
}
