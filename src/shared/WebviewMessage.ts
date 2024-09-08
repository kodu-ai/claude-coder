import { ApiConfiguration } from "../api"

type WebviewMessageAmplitude = {
	type: "amplitude"
	event_type: "Auth Start" | "Referral Program" | "Add Credits"
}

export type WebviewMessage =
	| WebviewMessageAmplitude
	| {
			type:
				| "cancelCurrentRequest"
				| "apiConfiguration"
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
			apiConfiguration?: ApiConfiguration
			images?: string[]
			bool?: boolean
	  }

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"
