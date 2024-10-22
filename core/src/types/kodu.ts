import { Anthropic } from "@anthropic-ai/sdk";
import { HistoryItem } from "./history-item";
import { ClaudeMessage } from "./claude-messages";
import { ClaudeAskResponse } from "./task-communication";
import { ResultPromise } from "execa";

export interface KoduDevOptions {
	maxRequestsPerTask?: number
	customInstructions?: string
	alwaysAllowReadOnly?: boolean
	experimentalTerminal?: boolean
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
	globalStoragePath?: string
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