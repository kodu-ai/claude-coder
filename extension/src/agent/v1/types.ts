import * as vscode from "vscode"
import { Anthropic } from "@anthropic-ai/sdk"
import { ResultPromise } from "execa"
import { ApiConfiguration } from "../../api"
import { ExtensionProvider } from "../../providers/claude-coder/claude-coder-provider"
import { ClaudeAskResponse } from "../../shared/webview-message"
import { HistoryItem } from "../../shared/history-item"
import { ClaudeMessage } from "../../shared/extension-message"

export type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

export type ToolResponseV2 = {
	status: "success" | "error" | "rejected" | "feedback"
	toolName: string
	toolId: string
	images?: string[]
	text?: string
	branch?: string
	preCommitHash?: string
	commitHash?: string
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
	inlineEditOutputType?: "full" | "diff"
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
	/**
	 * If true, the git handler will be enabled
	 */
	gitHandlerEnabled?: boolean
}

export type ApiHistoryItem = Anthropic.MessageParam & {
	ts?: number
	commitHash?: string
	branch?: string
	preCommitHash?: string
}

export type InterestedFile = {
	/**
	 * the absolute path of the file
	 */
	path: string
	/**
	 * why Kodu is interested in this file
	 */
	why: string
	/**
	 * the timestamp when the file was added to the list
	 */
	createdAt: number
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
	 * If true, the git handler is enabled
	 */
	gitHandlerEnabled?: boolean
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
	/**
	 * the list of interested files
	 */
	interestedFiles?: InterestedFile[]
	askResponseImages?: string[]
	lastMessageTs?: number
	executeCommandRunningProcess?: ResultPromise
	abort: boolean
	memory?: string
	dirAbsolutePath?: string
	isRepoInitialized?: boolean
}

// Re-export types from other files to centralize type definitions
export type { ClaudeMessage } from "../../shared/extension-message"
export type { ToolName } from "../../shared/tool"

export type VsCodeDiagnostics = [vscode.Uri, vscode.Diagnostic[]][]
