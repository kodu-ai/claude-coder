import { ClaudeAsk, ClaudeSay } from "../../../../shared/ExtensionMessage"
import { ClaudeAskResponse } from "../../../../shared/WebviewMessage"
import { KoduDev } from "../.."
import { TaskExecutorUtils } from "../../task-executor/utils"
import { ServerRunnerTool, ToolName } from "../../../../shared/new-tools"
import { ExecuteCommandToolParams } from "../schema/execute_command"
import { AskFollowupQuestionParams } from "../schema/ask_followup_question"
import { AttemptCompletionParams } from "../schema/attempt_completion"
import { ComputerUseParams } from "../schema/computer_use"
import { ListCodeDefinitionNamesParams } from "../schema/list_code_definition_names"
import { ListFilesParams } from "../schema/list_files"
import { ReadFileParams } from "../schema/read_file"
import { SearchFilesParams } from "../schema/search_files"
import { WriteToFileParams } from "../schema/write_to_file"
import { DevServerParams } from "../schema/dev_server"
import { WebSearchParams } from "../schema/web_search"
import { UrlScreenshotParams } from "../schema/url_screenshot"
import { AskConsultantParams } from "../schema/ask_consultant"
// First, let's create a mapping of tool names to their parameter types
export interface ToolParamsMap {
	write_to_file: WriteToFileParams
	read_file: ReadFileParams
	list_files: ListFilesParams
	search_files: SearchFilesParams
	list_code_definition_names: ListCodeDefinitionNamesParams
	ask_followup_question: AskFollowupQuestionParams
	attempt_completion: AttemptCompletionParams
	computer_use: ComputerUseParams
	execute_command: ExecuteCommandToolParams
	server_runner_tool: DevServerParams
	web_search: WebSearchParams
	url_screenshot: UrlScreenshotParams
	ask_consultant: AskConsultantParams
}

// The tool names constant now derives from our mapping
export const TOOL_NAMES = Object.freeze({
	write_to_file: "write_to_file",
	read_file: "read_file",
	list_files: "list_files",
	search_files: "search_files",
	list_code_definition_names: "list_code_definition_names",
	ask_followup_question: "ask_followup_question",
	attempt_completion: "attempt_completion",
	computer_use: "computer_use",
	execute_command: "execute_command",
	server_runner_tool: "server_runner_tool",
	web_search: "web_search",
	url_screenshot: "url_screenshot",
	ask_consultant: "ask_consultant",
} as const) satisfies Record<keyof ToolParamsMap, keyof ToolParamsMap>

// Our ToolNames type now comes from the mapping
export type ToolNames = keyof ToolParamsMap

// The ToolInput type becomes more strictly typed
export type ToolInput = {
	[K in ToolNames]: { name: K } & ToolParamsMap[K]
}[ToolNames]

// The AgentToolParams becomes more strictly typed as well
export type AgentToolParams<TName extends ToolNames> = {
	name: TName // Note: Changed from ToolName to TName for stricter typing
	id: string
	input: Extract<ToolInput, { name: TName }>
	ts: number
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
