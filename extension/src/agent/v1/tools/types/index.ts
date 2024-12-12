import { ClaudeAsk, ClaudeSay } from "../../../../shared/extension-message"
import { ToolName } from "../../../../shared/tool"
import { ClaudeAskResponse } from "../../../../shared/webview-message"
import { KoduDev } from "../.."
import { TaskExecutorUtils } from "../../task-executor/utils"
import { ServerRunnerTool } from "../../../../shared/new-tools"
import { AddInterestedFileToolParams } from "../schema/add_interested_file"
import { AskFollowupQuestionToolParams } from "../schema/ask_followup_question"
import { AttemptCompletionToolParams } from "../schema/attempt_completion"
import { ServerRunnerToolParams } from "../schema/dev_server"
import { ExecuteCommandToolParams } from "../schema/execute_command"
import { ListCodeDefinitionNamesToolParams } from "../schema/list_code_definition_names"
import { ListFilesToolParams } from "../schema/list_files"
import { ReadFileToolParams } from "../schema/read_file"
import { SearchFilesToolParams } from "../schema/search_files"
import { SearchSymbolsToolParams } from "../schema/search_symbols"
import { UrlScreenshotToolParams } from "../schema/url_screenshot"
import { WebSearchToolParams } from "../schema/web_search"
import { WriteToFileToolParams } from "../schema/write_to_file"
import { FileChangePlanParams } from "../schema/file-change-plan"
import { RejectFileChangesParams } from "../schema/reject-file-changes"

export type UpsertMemoryInput = {
	milestoneName: string
	summary: string
	content: string
}

export type ToolParams =
	| AddInterestedFileToolParams
	| AskFollowupQuestionToolParams
	| AttemptCompletionToolParams
	| ServerRunnerToolParams
	| ExecuteCommandToolParams
	| ListCodeDefinitionNamesToolParams
	| ListFilesToolParams
	| ReadFileToolParams
	| SearchFilesToolParams
	| SearchSymbolsToolParams
	| UrlScreenshotToolParams
	| WebSearchToolParams
	| FileChangePlanParams
	| RejectFileChangesParams
	| WriteToFileToolParams

export type AgentToolParams = {
	name: ToolParams["name"]
	id: string
	input: ToolParams["input"]
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
