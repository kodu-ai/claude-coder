import { ApiConfiguration } from "../api"
import { GlobalState } from "../providers/claude-coder/state/GlobalStateManager"

export type Resource =
	| { id: string; type: "file" | "folder"; name: string }
	| { id: string; type: "url"; description: string; name: string }

export type AmplitudeWebviewMessage = {
	type: "amplitude"
	event_type:
		| "AuthStart"
		| "ReferralProgram"
		| "ExtensionCreditAddOpen"
		| "TrialOfferView"
		| "TrialOfferStart"
		| "TrialUpsellView"
		| "TrialUpsellStart"
		| "ExtensionCreditAddSelect"
	key?: string
}

type RenameTask =
	| {
			type: "renameTask"
			taskId: string
			isCurentTask?: undefined
	  }
	| {
			type: "renameTask"
			taskId?: undefined
			isCurentTask: boolean
	  }

type OpenExternalLink = {
	type: "openExternalLink"
	url: string
}

type FreeTrial = {
	type: "freeTrial"
	fp: string
}

type ApiConfigurationMessage = {
	type: "apiConfiguration"
	apiConfiguration: NonNullable<ApiConfiguration>
}
type setUseUdiff = {
	type: "useUdiff"
	bool: boolean
}

type QuickstartMessage = {
	type: "quickstart"
	repo: string
	name: string
}

type experimentalTerminalMessage = {
	type: "experimentalTerminal"
	bool: boolean
}

type exportBugMessage = {
	type: "exportBug"
	description: string
	reproduction: string
}

type technicalBackgroundMessage = {
	type: "technicalBackground"
	value: NonNullable<GlobalState["technicalBackground"]>
}

type DebugMessage = {
	type: "debug"
}

export type GitCheckoutToMessage = {
	type: "gitCheckoutTo"
	branchName: string
}

type UpdateTaskHistoryMessage = {
	type: "updateTaskHistory"
	history: string
}

export type WebviewMessage =
	| exportBugMessage
	| experimentalTerminalMessage
	| AmplitudeWebviewMessage
	| OpenExternalLink
	| FreeTrial
	| technicalBackgroundMessage
	| ApiConfigurationMessage
	| RenameTask
	| QuickstartMessage
	| setUseUdiff
	| DebugMessage
	| GitCheckoutToMessage
	| UpdateTaskHistoryMessage
	| {
			type:
				| "cancelCurrentRequest"
				| "maxRequestsPerTask"
				| "customInstructions"
				| "alwaysAllowReadOnly"
				| "webviewDidLaunch"
				| "newTask"
				| "askResponse"
				| "retryTask"
				| "alwaysAllowWriteOnly"
				| "clearTask"
				| "didCloseAnnouncement"
				| "selectImages"
				| "exportCurrentTask"
				| "showTaskWithId"
				| "deleteTaskWithId"
				| "exportTaskWithId"
				| "abortAutomode"
				| "didClickKoduSignOut"
				| "fetchKoduCredits"
				| "didDismissKoduPromo"
				| "resetState"
				| "setCreativeMode"
				| "fileTree"
				| "clearHistory"
				| "gitLog"
				| "gitBranches"
				| "getTaskHistory"
			text?: string
			askResponse?: ClaudeAskResponse
			images?: string[]
			attachements?: Resource[]
			bool?: boolean
	  }

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"
