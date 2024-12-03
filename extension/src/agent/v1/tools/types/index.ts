import { ClaudeAsk, ClaudeSay } from "../../../../shared/ExtensionMessage"
import { ToolName } from "../../../../shared/Tool"
import { ClaudeAskResponse } from "../../../../shared/WebviewMessage"
import { KoduDev } from "../.."
import { TaskExecutorUtils } from "../../task-executor/utils"
import { ServerRunnerTool } from "../../../../shared/new-tools"

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
	kodu_content?: string
	kodu_diff?: string
	isFinal?: boolean
	regex?: string
	udiff?: string
	diff?: string
	filePattern?: string
	recursive?: string
	command?: string
	question?: string
	result?: string
	searchQuery?: string
	query?: string
	baseLink?: string
	browserModel?: "smart" | "fast"
	browserMode?: "api_docs" | "generic"
	url?: string
}

type DevServerToolParams = {
	name: "server_runner_tool"
	input: Omit<ServerRunnerTool, "tool">
}

export type AgentToolParams = {
	name: ToolName | "server_runner_tool"
	id: string
	input: ToolInput & DevServerToolParams["input"]
	ts: number
	/**
	 * If this is a sub message, it will force it to stick to previous tool call in the ui (same message)
	 */
	isSubMsg?: boolean
	isLastWriteToFile: boolean
	isFinal?: boolean
	ask: TaskExecutorUtils["askWithId"]
	say: TaskExecutorUtils["say"]
	updateAsk: TaskExecutorUtils["updateAsk"]
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

export type CommitInfo = {
	branch: string
	commitHash: string
	preCommitHash?: string
}
