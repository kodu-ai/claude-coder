import { ClaudeAsk, ClaudeSay } from "../../../../shared/extension-message"
import { ClaudeAskResponse } from "../../../../shared/webview-message"
import { KoduDev } from "../.."
import { TaskExecutorUtils } from "../../task-executor/utils"
import { ServerRunnerTool } from "../../../../shared/new-tools"
import { AddInterestedFileToolParams } from "../schema/add_interested_file"
import { AskFollowupQuestionToolParams } from "../schema/ask_followup_question"
import { AttemptCompletionToolParams } from "../schema/attempt_completion"
import { ServerRunnerToolParams } from "../schema/dev_server"
import { ExecuteCommandToolParams } from "../schema/execute_command"
import { ExploreRepoFolderToolParams } from "../schema/explore-repo-folder.schema"
import { ListFilesToolParams } from "../schema/list_files"
import { ReadFileToolParams } from "../schema/read_file"
import { SearchFilesToolParams } from "../schema/search_files"
import { SearchSymbolsToolParams } from "../schema/search_symbols"
import { UrlScreenshotToolParams } from "../schema/url_screenshot"
import { WebSearchToolParams } from "../schema/web_search"
import { EditFileBlocksToolParams, WriteToFileToolParams } from "../schema/write_to_file"
import { FileChangePlanParams } from "../schema/file-change-plan"
import { RejectFileChangesParams } from "../schema/reject-file-changes"
import { FileEditorToolParams } from "../schema/file_editor_tool"
import { SpawnAgentOptions, SpawnAgentToolParams } from "../schema/agents/agent-spawner"
import { ExitAgentToolParams } from "../schema/agents/agent-exit"
import { SubmitReviewToolParams } from "../schema/submit_review"

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
	| ExploreRepoFolderToolParams
	| ListFilesToolParams
	| ReadFileToolParams
	| SearchFilesToolParams
	| SearchSymbolsToolParams
	| UrlScreenshotToolParams
	| WebSearchToolParams
	| FileChangePlanParams
	| RejectFileChangesParams
	| WriteToFileToolParams
	| EditFileBlocksToolParams
	| FileEditorToolParams
	| SpawnAgentToolParams
	| ExitAgentToolParams
	| SubmitReviewToolParams

export type ToolName = ToolParams["name"]

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
	ask: TaskExecutorUtils["ask"]
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
	agentName?: SpawnAgentOptions
}

export type CommitInfo = {
	branch: string
	commitHash: string
	preCommitHash?: string
}
