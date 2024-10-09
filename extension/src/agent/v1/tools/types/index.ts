import { ClaudeAsk, ClaudeSay } from "../../../../shared/ExtensionMessage"
import { ToolName } from "../../../../shared/Tool"
import { ClaudeAskResponse } from "../../../../shared/WebviewMessage"
import { KoduDev } from "../.."

export type ToolInput = {
	path?: string
	content?: string
	regex?: string
	udiff?: string
	filePattern?: string
	recursive?: string
	command?: string
	question?: string
	result?: string
	searchQuery?: string
	query?: string
	baseLink?: string
	url?: string
	summary?: string
}

export type AgentToolParams = {
	name: ToolName
	input: ToolInput
	isLastWriteToFile: boolean
	ask: (type: ClaudeAsk, question?: string) => Promise<AskConfirmationResponse>
	say: (type: ClaudeSay, text?: string, images?: string[]) => void
	returnEmptyStringOnSuccess?: boolean
}

export type AskConfirmationResponse = {
	response: ClaudeAskResponse
	text?: string
	images?: string[]
}

export type AgentToolOptions = {
	cwd: string
	alwaysAllowReadOnly: boolean
	alwaysAllowWriteOnly: boolean
	koduDev: KoduDev
	setRunningProcessId?: (pid: number | undefined) => void
}
