import * as vscode from "vscode"
import { Anthropic } from "@anthropic-ai/sdk"
import { ResultPromise } from "execa"
import { ApiConfiguration, ApiConstructorOptions, ProviderSettings } from "../../../api"
import { ExtensionProvider } from "../../../providers/extension-provider"
import { ClaudeAskResponse } from "../../../shared/messages/client-message"
import { HistoryItem } from "../../../shared/history-item"
import { ClaudeMessage } from "../../../shared/messages/extension-message"
import { SpawnAgentOptions } from "../tools/schema/agents/agent-spawner"
import { ToolName } from "../tools/types"

export type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

export type ToolResponseV2 = {
	status: "success" | "error" | "rejected" | "feedback"
	toolName: ToolName
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
	apiConfiguration: ApiConstructorOptions
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

export type ApiHistoryItem = Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessageParam & {
	ts?: number
	commitHash?: string
	branch?: string
	preCommitHash?: string
}

export type FileVersion = {
	/**
	 * the absolute path of the file
	 */
	path: string
	/**
	 * the version of the file
	 */
	version: number
	/**
	 * the timestamp when the file was added to the list
	 */
	createdAt: number
	/**
	 * the content of the file at the specified version
	 */
	content: string
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

export type SubAgentState = {
	name: SpawnAgentOptions
	systemPrompt: string
	automaticReminders?: string
	modelId?: string
	apiConversationHistory: ApiHistoryItem[]
	/**
	 * the list of diagnostics errors for the current task
	 */
	historyErrors: Record<
		/**
		 * the file path
		 */
		string,
		{
			lastCheckedAt: number
			error: string
		}
	>
	ts: number
	state: "RUNNING" | "DONE" | "EXITED"
}

export interface KoduAgentState {
	taskId: string
	apiConversationHistory: ApiHistoryItem[]
	claudeMessages: ClaudeMessage[]
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
	historyErrors: Record<
		/**
		 * the file path
		 */
		string,
		{
			lastCheckedAt: number
			error: string
		}
	>
}

// Re-export types from other files to centralize type definitions
export type { ClaudeMessage } from "../../../shared/messages/extension-message"

export type VsCodeDiagnostics = [vscode.Uri, vscode.Diagnostic[]][]
