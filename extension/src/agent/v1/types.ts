import * as vscode from "vscode"
import { Anthropic } from "@anthropic-ai/sdk"
import { ResultPromise } from "execa"
import { ApiConfiguration } from "../../api"
import { ExtensionProvider } from "../../providers/claude-coder/ClaudeCoderProvider"
import { ClaudeAskResponse } from "../../shared/WebviewMessage"
import { HistoryItem } from "../../shared/HistoryItem"
import { ClaudeMessage } from "../../shared/ExtensionMessage"

export type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

export type ToolResponseV2 = {
	status: "success" | "error" | "rejected" | "feedback"
	toolName: string
	toolId: string
	images?: string[]
	text?: string
}

export type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>

export interface KoduDevOptions {
	provider: ExtensionProvider
	apiConfiguration: ApiConfiguration
	maxRequestsPerTask?: number
	autoSummarize?: boolean
	terminalCompressionThreshold?: number
	customInstructions?: string
	alwaysAllowReadOnly?: boolean
	experimentalTerminal?: boolean
	inlineEditOutputType?: "full" | "diff" | "none"
	alwaysAllowWriteOnly?: boolean
	skipWriteAnimation?: boolean
	autoCloseTerminal?: boolean
	creativeMode?: "creative" | "normal" | "deterministic"
	task?: string
	images?: string[]
	historyItem?: HistoryItem
	/**
	 * If true, the task will start with debugging the project
	 */
	isDebug?: boolean
}

export type ApiHistoryItem = Anthropic.MessageParam & {
	ts?: number
}

export interface KoduDevState {
	taskId: string
	requestCount: number
	apiConversationHistory: ApiHistoryItem[]
	claudeMessages: ClaudeMessage[]
	askResponse?: ClaudeAskResponse
	askResponseText?: string
	terminalCompressionThreshold?: number
	isHistoryItem?: boolean
	isHistoryItemResumed?: boolean
	/**
	 * the list of diagnostics errors for the current task
	 */
	historyErrors?: Record<
		/**
		 * the file path
		 */
		string,
		{
			lastCheckedAt: number
			error: string
		}
	>
	askResponseImages?: string[]
	lastMessageTs?: number
	executeCommandRunningProcess?: ResultPromise
	abort: boolean
	memory?: string
	dirAbsolutePath?: string
	isRepoInitialized?: boolean
}

export interface ClaudeRequestResult {
	didEndLoop: boolean
	inputTokens: number
	outputTokens: number
}

// Re-export types from other files to centralize type definitions
export type { ClaudeMessage } from "../../shared/ExtensionMessage"
export type { ToolName } from "../../shared/Tool"

export type VsCodeDiagnostics = [vscode.Uri, vscode.Diagnostic[]][]
