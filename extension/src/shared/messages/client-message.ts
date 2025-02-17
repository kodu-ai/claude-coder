import { ToolName } from "../../agent/v1/tools/types"
import { GlobalState } from "../../providers/state/global-state-manager"
import { BaseExtensionState } from "./extension-message"

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

type DebugMessage = {
	type: "debug"
}

export type updateGlobalStateMessage = {
	type: "updateGlobalState"
	state: Partial<GlobalState>
}

export type autoCloseTerminalMessage = {
	type: "autoCloseTerminal"
	bool: boolean
}

export type customInstructionsMessage = {
	type: "customInstructions"
	text: string
}

export type autoSummarizeMessage = {
	type: "autoSummarize"
	bool: boolean
}

export type pauseNextMessage = {
	type: "pauseNext"
}

export type setApiKeyDialogMessage = {
	type: "setApiKeyDialog"
}

export type terminalCompressionThresholdMessage = {
	type: "terminalCompressionThreshold"
	value?: number
}

export type pauseTemporayAutoModeMessage = {
	type: "pauseTemporayAutoMode"
	mode: boolean
}

export type setInlineEditModeMessage = {
	type: "setInlineEditMode"
	inlineEditOutputType?: "full" | "diff"
}

export type setCommandTimeoutMessage = {
	type: "commandTimeout"
	commandTimeout: number
}

export type savePromptTemplateMessage = {
	type: "savePromptTemplate"
	templateName: string
	content: string
}

export type loadPromptTemplateMessage = {
	type: "loadPromptTemplate"
	templateName: string
}

export type setActivePromptMessage = {
	type: "setActivePrompt"
	templateName: string | null
}

export type listPromptTemplatesMessage = {
	type: "listPromptTemplates"
}

export type deletePromptTemplateMessage = {
	type: "deletePromptTemplate"
	templateName: string
}

export type ClosePromptEditorMessage = {
	type: "closePromptEditor"
}

export type OpenPromptEditorMessage = {
	type: "openPromptEditor"
}

export type PreviewPromptMessage = {
	type: "previewPrompt"
	content: string
	visible: boolean
}

export type EnableObserverHookMessage = {
	type: "enableObserverHook"
	triggerEvery?: number
}

export type DisableToolMessage = {
	type: "disableTool"
	toolName: ToolName
	boolean: boolean
	content?: string
}

export type PromptActions =
	| PreviewPromptMessage
	| DisableToolMessage
	| OpenPromptEditorMessage
	| listPromptTemplatesMessage
	| savePromptTemplateMessage
	| loadPromptTemplateMessage
	| setActivePromptMessage
	| deletePromptTemplateMessage
	| ClosePromptEditorMessage

export type ActionMessage = {
	type: "action"
	action: "didBecomeVisible" | "koduAuthenticated" | "koduCreditsFetched"
	text?: string
	state?: BaseExtensionState
}

export type TemplatesListMessage = {
	type: "templates_list"
	templates: string[]
	activeTemplate: string | null
}

export type toggleGitHandlerMessage = {
	type: "toggleGitHandler"
	enabled: boolean
}

export type viewFileMessage = {
	type: "viewFile"
	path: string
	version: string
}

export type rollbackToCheckpointMessage = {
	type: "rollbackToCheckpoint"
	version: string
	path: string
	ts: number
}

export type clearHistoryMessage = {
	type: "clearHistory"
}

export type McpServerMessage = {
	type: "addMcpServer" | "configureMcpServer" | "removeMcpServer"
	serverName?: string
}

export type WebviewMessage =
	| EnableObserverHookMessage
	| PromptActions
	| ActionMessage
	| clearHistoryMessage
	| rollbackToCheckpointMessage
	| viewFileMessage
	| setCommandTimeoutMessage
	| toggleGitHandlerMessage
	| setInlineEditModeMessage
	| pauseTemporayAutoModeMessage
	| terminalCompressionThresholdMessage
	| setApiKeyDialogMessage
	| pauseNextMessage
	| autoSummarizeMessage
	| updateGlobalStateMessage
	| AmplitudeWebviewMessage
	| OpenExternalLink
	| autoCloseTerminalMessage
	| RenameTask
	| DebugMessage
	| customInstructionsMessage
	| McpServerMessage
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
				| "promptEditorLoaded"
				| "didClickKoduSignOut"
				| "fetchKoduCredits"
				| "resetState"
				| "fileTree"
			text?: string
			askResponse?: ClaudeAskResponse
			images?: string[]
			attachements?: Resource[]
			bool?: boolean
	  }

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"
