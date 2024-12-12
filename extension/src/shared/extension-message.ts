import type { GlobalState } from "../providers/claude-coder/state/global-state-manager"
import { ApiConfiguration } from "./api"
import { HistoryItem } from "./history-item"
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
	taskId: string
}

type PostClaudeMessage = {
	type: "claudeMessage"
	claudeMessage: ExtensionState["claudeMessages"][number] | undefined
	taskId: string
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

export type HideCommandBlockMessage = {
	type: "hideCommandBlock"
	identifier?: string
}

export type EnableTextAreasMessage = {
	type: "enableTextAreas"
}

export type RequestStatus = {
	type: "requestStatus"
	isRunning: boolean
}

export type SetInlineEditModeMessage = {
	type: "setInlineEditMode"
	inlineEditOutputType?: "full" | "diff" | "none"
}

export type SetCommandTimeoutMessage = {
	type: "setCommandTimeout"
	commandTimeout: number
}

export type ToggleGitHandlerMessage = {
	type: "toggleGitHandler"
	enabled: boolean
}

// webview will hold state
export type ExtensionMessage =
	| SetCommandTimeoutMessage
	| SetInlineEditModeMessage
	| ToggleGitHandlerMessage
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

			state?: BaseExtensionState
			images?: string[]
	  }
	| PostFoldersAndItems
	| PostClaudeMessages
	| PostGitLog
	| PostGitBranches
	| PostGitCheckoutSuccess
	| PostTaskHistory
	| CommandExecutionResponse
	| EnableTextAreasMessage
	| HideCommandBlockMessage
	| RequestStatus
	| PostClaudeMessage

export interface BaseExtensionState {
	version: string
	maxRequestsPerTask?: number
	lastShownAnnouncementId?: string
	gitHandlerEnabled?: boolean
	currentContextTokens: number
	currentContextWindow: number
	terminalCompressionThreshold: number | undefined
	inlineEditOutputType?: "full" | "diff"
	commandTimeout: number
	skipWriteAnimation?: boolean
	autoSummarize?: boolean
	customInstructions?: string
	alwaysAllowReadOnly?: boolean
	alwaysAllowWriteOnly?: boolean
	fpjsKey?: string
	user: GlobalState["user"]
	apiConfiguration?: ApiConfiguration
	themeName?: string
	uriScheme?: string
	extensionName?: string
	currentTaskId?: string
	taskHistory: HistoryItem[]
	shouldShowAnnouncement: boolean
	autoCloseTerminal: boolean
	fingerprint?: string
}

export interface ExtensionState extends BaseExtensionState {
	claudeMessages: ClaudeMessage[]
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
	/**
	 * should be rendered as a sub message or not
	 */
	isSubMessage?: boolean
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
	| "payment_required"
	| "chat_truncated"
	| "unauthorized"
	| "completion_result"
	| "user_feedback"
	| "user_feedback_diff"
	| "api_req_retried"
	| "command_output"
	| "tool"
	| "memory_updated"
	| "info"
	| "chat_finished"
	| "abort_automode"
	| "shell_integration_warning"
	| "show_terminal"

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