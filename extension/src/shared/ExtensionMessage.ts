// type that represents json data that is sent from extension to webview, called ExtensionMessage and has 'type' enum which can be 'plusButtonTapped' or 'settingsButtonTapped' or 'hello'

import type { GlobalState } from "../providers/claude-coder/state/GlobalStateManager"
import { ApiConfiguration } from "./api"
import { HistoryItem } from "./HistoryItem"
import { ChatTool } from "./new-tools"
interface FileTreeItem {
	id: string
	depth: number
	name: string
	children?: FileTreeItem[]
	type: "file" | "folder"
}
type PostFoldersAndItems = {
	type: "fileTree"
	tree: FileTreeItem[]
}

type PostGitLog = {
	type: "gitLog"
	history: GitLogItem[]
}

type PostGitBranches = {
	type: "gitBranches"
	branches: GitBranchItem[]
}

type PostGitCheckoutSuccess = {
	type: "gitCheckoutTo"
	isSuccess: boolean
}

type PostClaudeMessages = {
	type: "claudeMessages"
	claudeMessages: ExtensionState["claudeMessages"]
}

type PostTaskHistory = {
	type: "taskHistory"
	history: string
	isInitialized: boolean
}

export type CommandExecutionResponse = {
	type: "commandExecutionResponse"
	status: "response" | "error" | "exit"
	payload: string
	commandId?: string
}

// webview will hold state
export type ExtensionMessage =
	| {
			type: "action" | "state" | "selectedImages"
			text?: string
			user?: ExtensionState["user"]
			action?:
				| "chatButtonTapped"
				| "settingsButtonTapped"
				| "historyButtonTapped"
				| "didBecomeVisible"
				| "koduAuthenticated"
				| "koduCreditsFetched"

			state?: ExtensionState
			images?: string[]
	  }
	| PostFoldersAndItems
	| PostClaudeMessages
	| PostGitLog
	| PostGitBranches
	| PostGitCheckoutSuccess
	| PostTaskHistory
	| CommandExecutionResponse

export interface ExtensionState {
	version: string
	maxRequestsPerTask?: number
	lastShownAnnouncementId?: string
	customInstructions?: string
	alwaysAllowReadOnly?: boolean
	technicalBackground?: "no-technical" | "technical" | "developer"
	useUdiff?: boolean
	experimentalTerminal?: boolean
	alwaysAllowWriteOnly?: boolean
	creativeMode?: "creative" | "normal" | "deterministic"
	fpjsKey?: string
	user: GlobalState["user"]
	apiConfiguration?: ApiConfiguration
	themeName?: string
	uriScheme?: string
	extensionName?: string
	currentTaskId?: string
	claudeMessages: ClaudeMessage[]
	taskHistory: HistoryItem[]
	shouldShowAnnouncement: boolean
	shouldShowKoduPromo: boolean
	fingerprint?: string
}

type V0ClaudeMessage = {
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

/**
 * The status of the tool
 */
export type ToolStatus = "pending" | "rejected" | "approved" | "error" | "loading" | undefined

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

export const isV1ClaudeMessage = (message: ClaudeMessage): message is V1ClaudeMessage => {
	return (message as V1ClaudeMessage).v === 1
}

export type ClaudeAsk =
	| "request_limit_reached"
	| "followup"
	| "command"
	| "command_output"
	| "completion_result"
	| "api_req_failed"
	| "resume_task"
	| "resume_completed_task"
	| "tool"

export type ClaudeSay =
	| "task"
	| "error"
	| "api_req_started"
	| "api_req_finished"
	| "text"
	| "completion_result"
	| "user_feedback"
	| "user_feedback_diff"
	| "api_req_retried"
	| "command_output"
	| "tool"
	| "memory_updated"
	| "info"
	| "abort_automode"
	| "shell_integration_warning"
	| "terminal_view"

type WebSearchTool = {
	tool: "web_search"
	query: string
	baseLink: string
}

export type UrlScreenshotTool = {
	tool: "url_screenshot"
	url: string
	base64Image?: string
}

export type AskConsultantTool = {
	tool: "ask_consultant"
	context: string
}

export type ClaudeSayTool =
	| ChatTool
	| {
			tool:
				| "editedExistingFile"
				| "newFileCreated"
				| "readFile"
				| "listFilesTopLevel"
				| "listFilesRecursive"
				| "listCodeDefinitionNames"
				| "searchFiles"
			path?: string
			diff?: string
			content?: string
			regex?: string
			filePattern?: string
	  }

export type GitLogItem = {
	hash: string
	datetime: string
	message: string
}

export type GitBranchItem = {
	name: string
	lastCommitRelativeTime: string
	isCheckedOut: boolean
	lastCommitMessage: string
}
