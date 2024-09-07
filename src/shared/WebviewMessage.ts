import { ApiConfiguration } from "../api"

export interface WebviewMessage {
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
		| "amplitude"
	text?: string
	askResponse?: ClaudeAskResponse
	apiConfiguration?: ApiConfiguration
	images?: string[]
	bool?: boolean
}

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"
