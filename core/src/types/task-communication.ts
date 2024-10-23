import { ChatTool } from "./chat-tools"
import { Anthropic } from "@anthropic-ai/sdk"

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"

export interface AskResponse {
	response: ClaudeAskResponse
	text?: string
	images?: string[]
}

export type AskDetails = {
	question?: string
	tool?: ChatTool
}

export type AskForConfirmation = (type: ClaudeAsk, details?: AskDetails, askTs?: number) => Promise<AskResponse>

export type ClaudeAsk =
	| "request_limit_reached"
	| "followup"
	| "command"
	| "command_output"
	| "completion_result"
	| "api_req_failed"
	| "resume_task"
	| "resume_completed_task"
	| "tool"

export type ClaudeSay =
	| "task"
	| "error"
	| "api_req_started"
	| "api_req_finished"
	| "text"
	| "payment_required"
	| "unauthorized"
	| "completion_result"
	| "user_feedback"
	| "user_feedback_diff"
	| "api_req_retried"
	| "command_output"
	| "tool"
	| "memory_updated"
	| "info"
	| "abort_automode"
	| "shell_integration_warning"
	| "show_terminal"

export type ClaudeSayTool =
	| ChatTool
	| {
			tool:
				| "editedExistingFile"
				| "newFileCreated"
				| "readFile"
				| "listFilesTopLevel"
				| "listFilesRecursive"
				| "listCodeDefinitionNames"
				| "searchFiles"
			path?: string
			diff?: string
			content?: string
			regex?: string
			filePattern?: string
	  }

export type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>
