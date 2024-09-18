import { ClaudeAsk, ClaudeSay } from "../../../../shared/ExtensionMessage"
import { ToolName } from "../../../../shared/Tool"
import { ClaudeAskResponse } from "../../../../shared/WebviewMessage"
import { KoduDev } from "../.."

export type ToolInput = {
	path?: string
	content?: string
	regex?: string
	filePattern?: string
	recursive?: string
	command?: string
	question?: string
	result?: string
	searchQuery?: string
	baseLink?: string
	url?: string
}

export type AgentToolParams = {
	name: ToolName
	input: ToolInput
	isLastWriteToFile: boolean
	ask: (
		type: ClaudeAsk,
		question?: string
	) => Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }>
	say: (type: ClaudeSay, text?: string, images?: string[]) => void
	returnEmptyStringOnSuccess?: boolean
}

export type AgentToolOptions = {
	cwd: string
	alwaysAllowReadOnly: boolean
	alwaysAllowWriteOnly: boolean
	koduDev: KoduDev
	setRunningProcessId?: (pid: number | undefined) => void
}
