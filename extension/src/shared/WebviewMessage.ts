import { ApiConfiguration } from "../api"
import { GlobalState } from "../providers/claude-coder/state/GlobalStateManager"
import { SystemPromptVariant } from "./SystemPromptVariant"

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
		| "OfferwallView"
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

export type ExecuteCommandMessage = {
	type: "executeCommand"
	command: string
	isEnter: boolean
	commandId?: string
}

export type CommandInputMessage = {
	type: "commandInput"
	commandId: string
	input: string
}

export type activeSystemPromptVariantMessage = {
	type: "activeSystemPromptVariant"
	variantId: string
}

export type ToolFeedbackMessage = {
	type: "toolFeedback"
	toolId: number
	feedbackMessage?: string
	feedback: "approve" | "reject"
}

export type ToolFeedbackAllMessage = {
	type: "toolFeedbackAll"
	feedback: "approve" | "reject"
}

export type updateGlobalStateMessage = {
	type: "updateGlobalState"
	state: Partial<GlobalState>
}

export type autoCloseTerminalMessage = {
	type: "autoCloseTerminal"
	bool: boolean
}

export type systemPromptVariantsMessage = {
	type: "systemPromptVariants"
	variants: SystemPromptVariant[]
}

export type customInstructionsMessage = {
	type: "customInstructions"
	text: string
}

export type autoSummarizeMessage = {
	type: "autoSummarize"
	bool: boolean
}

export type isContinueGenerationEnabledMessage = {
	type: "isContinueGenerationEnabled"
	bool: boolean
}

export type pauseNextMessage = {
	type: "pauseNext"
}

export type setApiKeyDialogMessage = {
	type: "setApiKeyDialog"
}

export type WebviewMessage =
	| setApiKeyDialogMessage
	| pauseNextMessage
	| isContinueGenerationEnabledMessage
	| autoSummarizeMessage
	| updateGlobalStateMessage
	| systemPromptVariantsMessage
	| ToolFeedbackAllMessage
	| ToolFeedbackMessage
	| experimentalTerminalMessage
	| AmplitudeWebviewMessage
	| OpenExternalLink
	| FreeTrial
	| technicalBackgroundMessage
	| autoCloseTerminalMessage
	| ApiConfigurationMessage
	| RenameTask
	| QuickstartMessage
	| setUseUdiff
	| DebugMessage
	| GitCheckoutToMessage
	| UpdateTaskHistoryMessage
	| ExecuteCommandMessage
	| CommandInputMessage
	| activeSystemPromptVariantMessage
	| customInstructionsMessage
	| {
			type:
				| "skipWriteAnimation"
				| "cancelCurrentRequest"
				| "maxRequestsPerTask"
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
