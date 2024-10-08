import { ApiConfiguration } from "../api"
import { GlobalState } from "../providers/claude-coder/state/GlobalStateManager"

export type Resource = {
	id: string
	type: "file" | "folder" | "url"
	name: string
}

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
			text?: string
			askResponse?: ClaudeAskResponse
			images?: string[]
			attachements?: Resource[]
			bool?: boolean
	  }

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"
