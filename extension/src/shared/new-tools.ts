import { ToolStatus } from "./extension-message"

/**
 * This is the input and output for execute_command tool
 */
export type ExecuteCommandTool = {
	tool: "execute_command"
	/**
	 * the output of the command
	 */
	output?: string
} & ExecuteCommandToolParams

export type ListFilesTool = {
	tool: "list_files"
	path: string
	recursive?: "true" | "false"
	content?: string
}

export type ExploreRepoFolderTool = {
	tool: "explore_repo_folder"
	path: string
	content?: string
}

export type SearchFilesTool = {
	tool: "search_files"
	path: string
	regex: string
	filePattern?: string
	content?: string
}

export type ReadFileTool = {
	tool: "read_file"
	path: string
	content: string
	pageNumber?: number
	readAllPages?: boolean
}

export type WriteToFileTool = {
	tool: "write_to_file"
	mode?: "inline" | "whole"
	path: string
	content?: string
	diff?: string
	notAppliedCount?: number
	branch?: string
	commitHash?: string
}

export type EditFileBlocks = {
	tool: "edit_file_blocks"
}

export type AskFollowupQuestionTool = {
	tool: "ask_followup_question"
	question: string
}

export type AttemptCompletionTool = {
	tool: "attempt_completion"
	command?: string
	commandResult?: string
	result: string
}

export interface WebSearchTool {
	tool: "web_search"
	searchQuery: string
	baseLink?: string
	content?: string
	browserModel?: "smart" | "fast"
	browserMode?: "api_docs" | "generic"
	streamType?: "start" | "explore" | "summarize" | "end"
}

export type ServerRunnerTool = {
	tool: "server_runner_tool"
	port?: number
	serverName?: string
	commandType?: "start" | "stop" | "restart" | "getLogs"
	output?: string
	commandToRun?: string
	lines?: string
}

export type UrlScreenshotTool = {
	tool: "url_screenshot"
	url: string
	base64Image?: string
}

export type UpsertMemoryTool = {
	tool: "upsert_memory"
	milestoneName?: string
	summary?: string
	content?: string
}

export type SearchSymbolsTool = {
	tool: "search_symbol"
	symbolName: string
	content?: string
}

export type AddInterestedFileTool = {
	tool: "add_interested_file"
	path: string
	why: string
}

export type FileChangePlanTool = {
	tool: "file_changes_plan"
	path: string
	what_to_accomplish: string
	innerThoughts?: string
	innerSelfCritique?: string
	rejectedString?: string
}

export type FileEditorTool = {
	tool: "file_editor"
	path: string
	mode: "edit" | "whole_write" | "rollback" | "list_versions"
	kodu_content?: string
	kodu_diff?: string
	list_versions?: boolean
	rollback_version?: string
	list_versions_output?: string
	saved_version?: string
	notAppliedCount?: number
	commitHash?: string
	branch?: string
}

export type ComputerUseTool = {
	tool: "computer_use"
	action: ComputerUseAction
	url?: string
	base64Image?: string
	coordinate?: string
	text?: string
}

export type ChatTool = (
	| EditFileBlocks
	| ExecuteCommandTool
	| ListFilesTool
	| ExploreRepoFolderTool
	| SearchFilesTool
	| ReadFileTool
	| WriteToFileTool
	| AskFollowupQuestionTool
	| AttemptCompletionTool
	| WebSearchTool
	| UrlScreenshotTool
	| ServerRunnerTool
	| SearchSymbolsTool
	| FileEditorTool
	| AddInterestedFileTool
	| FileChangePlanTool
) & {
	ts: number
	approvalState?: ToolStatus
	/**
	 * If this is a sub message, it will force it to stick to previous tool call in the ui (same message)
	 */
	isSubMsg?: boolean
	error?: string
	userFeedback?: string
}
