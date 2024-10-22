import { IKoduDev } from "@/interfaces"
import { Anthropic } from "@anthropic-ai/sdk"
import { AskDetails, AskResponse, ClaudeAsk, ClaudeAskResponse, ClaudeSay } from "./task-communication"

export type ToolName =
	| "write_to_file"
	| "read_file"
	| "list_files"
	| "list_code_definition_names"
	| "search_files"
	| "execute_command"
	| "ask_followup_question"
	| "attempt_completion"
	| "web_search"
	| "url_screenshot"
	| "ask_consultant"
	| "update_file"
	| "upsert_memory"

export type Tool = Omit<Anthropic.Tool, "name"> & {
	name: ToolName
}

export type ToolStatus = "pending" | "rejected" | "approved" | "error" | "loading" | undefined

export type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>;

export type UpsertMemoryInput = {
	milestoneName: string
	summary: string
	content: string
}

export type ToolInput = {
	milestoneName?: string
	summary?: string
	path?: string
	content?: string
	isFinal?: boolean
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
}

export type AgentToolParams = {
	name: ToolName
	id: string
	input: ToolInput
	ts: number
	/**
	 * If this is a sub message, it will force it to stick to previous tool call in the ui (same message)
	 */
	isSubMsg?: boolean
	isLastWriteToFile: boolean
	isFinal?: boolean
	ask: (type: ClaudeAsk, data?: AskDetails, askTs?: number) => Promise<AskResponse>
	say: (type: ClaudeSay, text?: string, images?: string[], sayTs?: number) => Promise<number>
	updateAsk: (type: ClaudeAsk, data: AskDetails, askTs: number) => Promise<void>
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
	koduDev: IKoduDev
	setRunningProcessId?: (pid: number | undefined) => void
}
