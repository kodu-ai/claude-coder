import { ApiConfiguration } from "../api"

type WebviewMessageAmplitude = {
	type: "amplitude"
	event_type: "Auth Start" | "Referral Program" | "Add Credits"
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

export type WebviewMessage =
	| WebviewMessageAmplitude
	| OpenExternalLink
	| FreeTrial
	| ApiConfigurationMessage
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
			text?: string
			askResponse?: ClaudeAskResponse
			images?: string[]
			bool?: boolean
	  }

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"
