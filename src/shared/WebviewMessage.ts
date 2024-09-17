import { ApiConfiguration } from "../api"

type WebviewMessageAmplitude = {
	type: "amplitude"
	event_type: "Auth Start" | "Referral Program" | "Add Credits"
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

type QuickstartMessage = {
	type: "quickstart"
	repo: string
	name: string
}

export type WebviewMessage =
	| WebviewMessageAmplitude
	| OpenExternalLink
	| FreeTrial
	| ApiConfigurationMessage
	| RenameTask
	| QuickstartMessage
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
			text?: string
			askResponse?: ClaudeAskResponse
			images?: string[]
			bool?: boolean
	  }

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"
