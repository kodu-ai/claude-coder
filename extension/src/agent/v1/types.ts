import * as vscode from "vscode"
import { Anthropic } from "@anthropic-ai/sdk"
import { ResultPromise } from "execa"
import { ApiConfiguration } from "../../api"
import { ExtensionProvider } from "../../providers/claude-coder/ClaudeCoderProvider"
import { ClaudeAskResponse } from "../../shared/WebviewMessage"
import { HistoryItem } from "../../shared/HistoryItem"
import { ClaudeMessage } from "../../shared/ExtensionMessage"

export type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>
export type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>

export interface KoduDevOptions {
	provider: ExtensionProvider
	apiConfiguration: ApiConfiguration
	maxRequestsPerTask?: number
	customInstructions?: string
	alwaysAllowReadOnly?: boolean
	experimentalTerminal?: boolean
	alwaysAllowWriteOnly?: boolean
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

export interface KoduDevState {
	taskId: string
	requestCount: number
	apiConversationHistory: Anthropic.MessageParam[]
	claudeMessages: ClaudeMessage[]
	askResponse?: ClaudeAskResponse
	askResponseText?: string
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
