import { ComputerUseAction } from "../agent/v1/tools/schema/computer_use"
import { ToolStatus } from "./ExtensionMessage"
import { ExecuteCommandToolParams } from "../agent/v1/tools/schema/execute_command"

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

export type ListCodeDefinitionNamesTool = {
	tool: "list_code_definition_names"
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

export type AskConsultantTool = {
	tool: "ask_consultant"
	query: string
	result?: string
}

export type UpsertMemoryTool = {
	tool: "upsert_memory"
	milestoneName?: string
	summary?: string
	content?: string
}

export type SummarizeChatTool = {
	tool: "summarize"
	cost?: number
	output?: string
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
	| ExecuteCommandTool
	| ListFilesTool
	| ListCodeDefinitionNamesTool
	| SearchFilesTool
	| ReadFileTool
	| WriteToFileTool
	| AskFollowupQuestionTool
	| AttemptCompletionTool
	| WebSearchTool
	| UrlScreenshotTool
	| AskConsultantTool
	| ServerRunnerTool
	| ComputerUseTool
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

export type ToolName = ChatTool["tool"]
