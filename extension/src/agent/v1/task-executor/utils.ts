import { ClaudeAsk, ClaudeSay, ClaudeMessage, ToolStatus, V1ClaudeMessage } from "../../../shared/extension-message"
import { ClaudeAskResponse } from "../../../shared/webview-message"
import { StateManager } from "../state-manager"
import { ExtensionProvider } from "../../../providers/claude-coder/claude-coder-provider"
import { ChatTool } from "../../../shared/new-tools"

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
	type:
		| "API_ERROR"
		| "TOOL_ERROR"
		| "USER_ABORT"
		| "UNKNOWN_ERROR"
		| "UNAUTHORIZED"
		| "PAYMENT_REQUIRED"
		| "NETWORK_ERROR"
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

export abstract class TaskExecutorUtils {
	protected stateManager: StateManager
	protected providerRef: WeakRef<ExtensionProvider>

	constructor(stateManager: StateManager, providerRef: WeakRef<ExtensionProvider>) {
		this.stateManager = stateManager
		this.providerRef = providerRef
	}

	// Abstract methods that must be implemented by derived classes
	public abstract ask(type: ClaudeAsk, data?: AskDetails, askTs?: number): Promise<AskResponse>
	public abstract handleAskResponse(response: ClaudeAskResponse, text?: string, images?: string[]): void

	public async updateAsk(type: ClaudeAsk, data: AskDetails, askTs: number): Promise<void> {
		const { question, tool } = data
		// check if there is an existing ask message with the same ts if not create a new one
		const askMessage: V1ClaudeMessage = {
			ts: askTs,
			type: "ask",
			ask: type,
			text: question ? question : tool ? JSON.stringify(tool) : "",
			v: 1,
			status: tool?.approvalState,
			autoApproved: !!this.stateManager.alwaysAllowWriteOnly,
		}
		if (!this.stateManager.getMessageById(askTs)) {
			await this.stateManager.addToClaudeMessages(askMessage)
			await this.providerRef.deref()?.getWebviewManager().postClaudeMessageToWebview(askMessage)
			return
		}

		const askMessageLatest = await this.stateManager?.updateClaudeMessage(askTs, askMessage)
		await this.providerRef
			.deref()
			?.getWebviewManager()
			.postClaudeMessageToWebview(askMessageLatest ?? askMessage)
	}

	public async sayWithId(sayTs: number, type: ClaudeSay, text?: string, images?: string[]): Promise<number> {
		const sayMessage: ClaudeMessage = {
			ts: sayTs,
			type: "say",
			say: type,
			text: text,
			images,
			isFetching: type === "api_req_started",
			v: 1,
		}
		if (this.stateManager.getMessageById(sayTs)) {
			await this.stateManager.updateClaudeMessage(sayTs, sayMessage)
		} else {
			await this.stateManager.addToClaudeMessages(sayMessage)
		}
		await this.providerRef.deref()?.getWebviewManager().postClaudeMessageToWebview(sayMessage)
		return sayTs
	}

	public async say(
		type: ClaudeSay,
		text?: string,
		images?: string[],
		sayTs = Date.now(),
		options: Partial<V1ClaudeMessage> = {}
	): Promise<number> {
		const sayMessage: ClaudeMessage = {
			ts: sayTs,
			type: "say",
			say: type,
			text: text,
			images,
			isFetching: type === "api_req_started",
			v: 1,
			...options,
		}

		await this.stateManager.addToClaudeMessages(sayMessage)
		await this.providerRef.deref()?.getWebviewManager().postClaudeMessageToWebview(sayMessage)
		return sayTs
	}

	protected logState(message: string): void {
		console.log(`[TaskExecutor] ${message} (State: ${this.getState()})`)
	}

	protected logError(error: TaskError): void {
		console.error(`[TaskExecutor] Error (State: ${this.getState()}):`, error)
	}

	protected abstract getState(): TaskState
}
