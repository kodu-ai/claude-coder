// type that represents json data that is sent from extension to webview, called ExtensionMessage and has 'type' enum which can be 'plusButtonTapped' or 'settingsButtonTapped' or 'hello'

import type { GlobalState } from "../providers/claude-dev/state/GlobalStateManager"
import { ApiConfiguration } from "./api"
import { HistoryItem } from "./HistoryItem"

// webview will hold state
export interface ExtensionMessage {
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

export interface ExtensionState {
	version: string
	maxRequestsPerTask?: number
	lastShownAnnouncementId?: string
	customInstructions?: string
	alwaysAllowReadOnly?: boolean
	alwaysAllowWriteOnly?: boolean
	creativeMode?: "creative" | "normal" | "deterministic"
	fpjsKey?: string
	user: GlobalState["user"]
	apiConfiguration?: ApiConfiguration
	themeName?: string
	uriScheme?: string
	extensionName?: string
	claudeMessages: ClaudeMessage[]
	taskHistory: HistoryItem[]
	shouldShowAnnouncement: boolean
	shouldShowKoduPromo: boolean
	fingerprint?: string
}

export interface ClaudeMessage {
	ts: number
	type: "ask" | "say"
	ask?: ClaudeAsk
	say?: ClaudeSay
	text?: string
	images?: string[]
}

export type ClaudeAsk =
	| "request_limit_reached"
	| "followup"
	| "command"
	| "command_output"
	| "completion_result"
	| "tool"
	| "api_req_failed"
	| "resume_task"
	| "resume_completed_task"

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
	| "abort_automode"

type WebSearchTool = {
	tool: "web_search"
	query: string
	baseLink: string
}
export type ClaudeSayTool =
	| WebSearchTool
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
