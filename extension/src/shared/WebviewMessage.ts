import type { ApiConfiguration } from '../api'
import type { GlobalState } from '../providers/claude-coder/state/GlobalStateManager'

export type Resource =
	| { id: string; type: 'file' | 'folder'; name: string }
	| { id: string; type: 'url'; description: string; name: string }

export type AmplitudeWebviewMessage = {
	type: 'amplitude'
	event_type:
		| 'AuthStart'
		| 'ReferralProgram'
		| 'ExtensionCreditAddOpen'
		| 'TrialOfferView'
		| 'TrialOfferStart'
		| 'TrialUpsellView'
		| 'TrialUpsellStart'
		| 'ExtensionCreditAddSelect'
		| 'OfferwallView'
	key?: string
}

type RenameTask =
	| {
			type: 'renameTask'
			taskId: string
			isCurentTask?: undefined
	  }
	| {
			type: 'renameTask'
			taskId?: undefined
			isCurentTask: boolean
	  }

type OpenExternalLink = {
	type: 'openExternalLink'
	url: string
}

type FreeTrial = {
	type: 'freeTrial'
	fp: string
}

type ApiConfigurationMessage = {
	type: 'apiConfiguration'
	apiConfiguration: NonNullable<ApiConfiguration>
}
type SetUseUdiff = {
	type: 'useUdiff'
	bool: boolean
}

type QuickstartMessage = {
	type: 'quickstart'
	repo: string
	name: string
}

type ExperimentalTerminalMessage = {
	type: 'experimentalTerminal'
	bool: boolean
}

type ExportBugMessage = {
	type: 'exportBug'
	description: string
	reproduction: string
}

type TechnicalBackgroundMessage = {
	type: 'technicalBackground'
	value: NonNullable<GlobalState['technicalBackground']>
}

type DebugMessage = {
	type: 'debug'
}

export type GitCheckoutToMessage = {
	type: 'gitCheckoutTo'
	branchName: string
}

type UpdateTaskHistoryMessage = {
	type: 'updateTaskHistory'
	history: string
}

export type ExecuteCommandMessage = {
	type: 'executeCommand'
	command: string
	isEnter: boolean
	commandId?: string
}

export type CommandInputMessage = {
	type: 'commandInput'
	commandId: string
	input: string
}

export type ToolFeedbackMessage = {
	type: 'toolFeedback'
	toolId: number
	feedback: 'approve' | 'reject'
}

export type ToolFeedbackAllMessage = {
	type: 'toolFeedbackAll'
	feedback: 'approve' | 'reject'
}

export type SummarizationThresholdMessage = {
	type: 'setSummarizationThreshold'
	value: NonNullable<GlobalState['summarizationThreshold']>
}

export type updateGlobalStateMessage = {
	type: 'updateGlobalState'
	state: Partial<GlobalState>
}

export type autoCloseTerminalMessage = {
	type: 'autoCloseTerminal'
	bool: boolean
}

export type WebviewMessage =
	| updateGlobalStateMessage
	| ToolFeedbackAllMessage
	| ToolFeedbackMessage
	| ExportBugMessage
	| ExperimentalTerminalMessage
	| AmplitudeWebviewMessage
	| OpenExternalLink
	| FreeTrial
	| TechnicalBackgroundMessage
	| autoCloseTerminalMessage
	| ApiConfigurationMessage
	| RenameTask
	| QuickstartMessage
	| SetUseUdiff
	| DebugMessage
	| GitCheckoutToMessage
	| UpdateTaskHistoryMessage
	| ExecuteCommandMessage
	| CommandInputMessage
	| SummarizationThresholdMessage
	| {
			type:
				| 'skipWriteAnimation'
				| 'cancelCurrentRequest'
				| 'maxRequestsPerTask'
				| 'customInstructions'
				| 'alwaysAllowReadOnly'
				| 'webviewDidLaunch'
				| 'newTask'
				| 'askResponse'
				| 'retryTask'
				| 'alwaysAllowWriteOnly'
				| 'clearTask'
				| 'didCloseAnnouncement'
				| 'selectImages'
				| 'exportCurrentTask'
				| 'showTaskWithId'
				| 'deleteTaskWithId'
				| 'exportTaskWithId'
				| 'abortAutomode'
				| 'didClickKoduSignOut'
				| 'fetchKoduCredits'
				| 'didDismissKoduPromo'
				| 'resetState'
				| 'setCreativeMode'
				| 'fileTree'
				| 'clearHistory'
				| 'gitLog'
				| 'gitBranches'
				| 'getTaskHistory'
			text?: string
			askResponse?: ClaudeAskResponse
			images?: string[]
			attachements?: Resource[]
			bool?: boolean
	  }

export type ClaudeAskResponse = 'yesButtonTapped' | 'noButtonTapped' | 'messageResponse'
