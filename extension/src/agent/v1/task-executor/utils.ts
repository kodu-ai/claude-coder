import type { ExtensionProvider } from '../../../providers/claude-coder/ClaudeCoderProvider'
import type { ClaudeAsk, ClaudeMessage, ClaudeSay, V1ClaudeMessage } from '../../../shared/ExtensionMessage'
import type { ClaudeAskResponse } from '../../../shared/WebviewMessage'
import type { ChatTool } from '../../../shared/new-tools'
import type { StateManager } from '../state-manager'

export enum TaskState {
	IDLE = 'IDLE',
	WAITING_FOR_API = 'WAITING_FOR_API',
	PROCESSING_RESPONSE = 'PROCESSING_RESPONSE',
	EXECUTING_TOOL = 'EXECUTING_TOOL',
	WAITING_FOR_USER = 'WAITING_FOR_USER',
	COMPLETED = 'COMPLETED',
	ABORTED = 'ABORTED',
}

export class TaskError extends Error {
	type: 'API_ERROR' | 'TOOL_ERROR' | 'USER_ABORT' | 'UNKNOWN_ERROR' | 'UNAUTHORIZED' | 'PAYMENT_REQUIRED'
	constructor({
		type,
		message,
	}: {
		type: 'API_ERROR' | 'TOOL_ERROR' | 'USER_ABORT' | 'UNKNOWN_ERROR' | 'UNAUTHORIZED' | 'PAYMENT_REQUIRED'
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

export abstract class TaskExecutorUtils {
	protected stateManager: StateManager
	protected providerRef: WeakRef<ExtensionProvider>
	protected pendingAskResponse: ((value: AskResponse) => void) | null = null

	constructor(stateManager: StateManager, providerRef: WeakRef<ExtensionProvider>) {
		this.stateManager = stateManager
		this.providerRef = providerRef
	}

	public async summarizeTask(): Promise<void> {
		// Popup a message using alert
		alert('Task is too long !')
	}

	public async ask(type: ClaudeAsk, data?: AskDetails): Promise<AskResponse> {
		const { question, tool } = data ?? {}
		return new Promise((resolve) => {
			const askTs = Date.now()
			const askMessage: V1ClaudeMessage = {
				ts: askTs,
				type: 'ask',
				ask: type,
				text: question ? question : tool ? JSON.stringify(tool) : '',
				v: 1,
				status: tool?.approvalState,
				autoApproved: !!this.stateManager.alwaysAllowWriteOnly,
			}

			this.stateManager.addToClaudeMessages(askMessage)
			console.log(`TS: ${askTs}\nWe asked: ${type}\nQuestion: ${question}`)
			this.updateWebview()

			const mustRequestApproval: ClaudeAsk[] = [
				'completion_result',
				'resume_completed_task',
				'resume_task',
				'request_limit_reached',
				'followup',
			]

			if (this.stateManager.alwaysAllowWriteOnly && !mustRequestApproval.includes(type)) {
				resolve({ response: 'yesButtonTapped', text: '', images: [] })
				return
			}

			this.pendingAskResponse = resolve
		})
	}

	public async askWithId(type: ClaudeAsk, data?: AskDetails, askTs?: number): Promise<AskResponse> {
		// set default askTs if not provided
		if (!askTs) {
			askTs = Date.now()
		}
		const { question, tool } = data ?? {}
		// if it's a tool, get the ts from the tool
		if (tool && !askTs && tool.ts) {
			askTs = tool.ts
		}
		return new Promise((resolve) => {
			const readCommands: ChatTool['tool'][] = [
				'read_file',
				'list_files',
				'search_files',
				'list_code_definition_names',
				'web_search',
				'url_screenshot',
			]
			const mustRequestApprovalType: ClaudeAsk[] = [
				'completion_result',
				'resume_completed_task',
				'resume_task',
				'request_limit_reached',
				'followup',
			]
			const mustRequestApprovalTool: ChatTool['tool'][] = ['ask_followup_question', 'attempt_completion']
			if (
				tool &&
				tool.approvalState === 'pending' &&
				((this.stateManager.alwaysAllowReadOnly && readCommands.includes(tool?.tool as ChatTool['tool'])) ||
					(this.stateManager.alwaysAllowWriteOnly &&
						!mustRequestApprovalTool.includes(tool?.tool as ChatTool['tool'])))
			) {
				// update the tool.status
				tool.approvalState = 'loading'
			}

			const askMessage: V1ClaudeMessage = {
				ts: askTs,
				type: 'ask',
				ask: type,
				text: question ? question : tool ? JSON.stringify(tool) : '',
				v: 1,
				status: tool?.approvalState,
				autoApproved: !!this.stateManager.alwaysAllowWriteOnly,
			}
			if (this.stateManager.getMessageById(askTs)) {
				this.stateManager.updateClaudeMessage(askTs, askMessage)
			} else {
				this.stateManager.addToClaudeMessages(askMessage)
			}
			console.log(`TS: ${askTs}\nWe asked: ${type}\nQuestion: ${question}`)
			this.updateWebview()

			if (this.stateManager.alwaysAllowReadOnly && readCommands.includes(tool?.tool as ChatTool['tool'])) {
				resolve({ response: 'yesButtonTapped', text: '', images: [] })
				return
			}

			if (
				this.stateManager.alwaysAllowWriteOnly &&
				!mustRequestApprovalType.includes(type) &&
				!mustRequestApprovalTool.includes(tool?.tool as ChatTool['tool'])
			) {
				resolve({ response: 'yesButtonTapped', text: '', images: [] })
				return
			}

			this.pendingAskResponse = resolve
		})
	}

	public async updateAsk(type: ClaudeAsk, data: AskDetails, askTs: number): Promise<void> {
		const { question, tool } = data
		const askMessage: V1ClaudeMessage = {
			ts: askTs,
			type: 'ask',
			ask: type,
			text: question ? question : tool ? JSON.stringify(tool) : '',
			v: 1,
			status: tool?.approvalState,
			autoApproved: !!this.stateManager.alwaysAllowWriteOnly,
		}

		await this.stateManager?.updateClaudeMessage(askTs, askMessage)
		await this.updateWebview()
	}

	public async sayWithId(sayTs: number, type: ClaudeSay, text?: string, images?: string[]): Promise<number> {
		const sayMessage: ClaudeMessage = {
			ts: sayTs,
			type: 'say',
			say: type,
			text: text,
			images,
			isFetching: type === 'api_req_started',
			v: 1,
		}
		if (this.stateManager.getMessageById(sayTs)) {
			await this.stateManager.updateClaudeMessage(sayTs, sayMessage)
		} else {
			await this.stateManager.addToClaudeMessages(sayMessage)
		}
		await this.updateWebview()
		return sayTs
	}

	public async say(type: ClaudeSay, text?: string, images?: string[], sayTs = Date.now()): Promise<number> {
		const sayMessage: ClaudeMessage = {
			ts: sayTs,
			type: 'say',
			say: type,
			text: text,
			images,
			isFetching: type === 'api_req_started',
			v: 1,
		}

		await this.stateManager.addToClaudeMessages(sayMessage)
		await this.updateWebview()
		return sayTs
	}

	public async sayAfter(type: ClaudeSay, target: number, text?: string, images?: string[]): Promise<void> {
		console.log(`Saying after: ${type} ${text}`)
		const sayMessage: ClaudeMessage = {
			ts: Date.now(),
			type: 'say',
			say: type,
			text: text,
			images,
			v: 1,
		}

		await this.stateManager.addToClaudeAfterMessage(target, sayMessage)
		await this.updateWebview()
	}

	public handleAskResponse(response: ClaudeAskResponse, text?: string, images?: string[]): void {
		if (this.pendingAskResponse) {
			this.pendingAskResponse({ response, text, images })
			this.pendingAskResponse = null
		}
	}

	protected logState(message: string): void {
		console.log(`[TaskExecutor] ${message} (State: ${this.getState()})`)
	}

	protected logError(error: TaskError): void {
		console.error(`[TaskExecutor] Error (State: ${this.getState()}):`, error)
	}

	protected abstract getState(): TaskState

	private async updateWebview(): Promise<void> {
		await this.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
	}
}
