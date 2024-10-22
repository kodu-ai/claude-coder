import { ChatTool, ClaudeAsk, ClaudeAskResponse } from "."

export enum TaskState {
	IDLE = "IDLE",
	WAITING_FOR_API = "WAITING_FOR_API",
	PROCESSING_RESPONSE = "PROCESSING_RESPONSE",
	EXECUTING_TOOL = "EXECUTING_TOOL",
	WAITING_FOR_USER = "WAITING_FOR_USER",
	COMPLETED = "COMPLETED",
	ABORTED = "ABORTED",
}

export class TaskError extends Error {
	type: "API_ERROR" | "TOOL_ERROR" | "USER_ABORT" | "UNKNOWN_ERROR" | "UNAUTHORIZED" | "PAYMENT_REQUIRED"
	constructor({
		type,
		message,
	}: {
		type: "API_ERROR" | "TOOL_ERROR" | "USER_ABORT" | "UNKNOWN_ERROR" | "UNAUTHORIZED" | "PAYMENT_REQUIRED"
		message: string
	}) {
		super(message)
		this.type = type
	}
}

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
