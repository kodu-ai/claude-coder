import { ChatTool, ClaudeAsk, ClaudeSay, ClaudeMessage, V1ClaudeMessage, ClaudeAskResponse, AskDetails, AskResponse, TaskError, TaskState } from "@/types"
import { StateService } from "../state/state.service"



export abstract class TaskExecutorUtils {
	protected stateService: StateService
	protected pendingAskResponse: ((value: AskResponse) => void) | null = null

	constructor(stateService: StateService) {
		this.stateService = stateService
	}

	public async ask(type: ClaudeAsk, data?: AskDetails): Promise<AskResponse> {
		const { question, tool } = data ?? {}
		return new Promise((resolve) => {
			const askTs = Date.now()
			const askMessage: V1ClaudeMessage = {
				ts: askTs,
				type: "ask",
				ask: type,
				text: question ? question : tool ? JSON.stringify(tool) : "",
				v: 1,
				status: tool?.approvalState,
				autoApproved: !!this.stateService.alwaysAllowWriteOnly,
			}

			this.stateService.addToClaudeMessages(askMessage)
			console.log(`TS: ${askTs}\nWe asked: ${type}\nQuestion: ${question}`)
			this.updateWebview()

			const mustRequestApproval: ClaudeAsk[] = [
				"completion_result",
				"resume_completed_task",
				"resume_task",
				"request_limit_reached",
				"followup",
			]

			if (this.stateService.alwaysAllowWriteOnly && !mustRequestApproval.includes(type)) {
				resolve({ response: "yesButtonTapped", text: "", images: [] })
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
		return new Promise(async (resolve) => {
			const readCommands: ChatTool["tool"][] = [
				"read_file",
				"list_files",
				"search_files",
				"list_code_definition_names",
				"web_search",
				"url_screenshot",
			]
			const mustRequestApprovalType: ClaudeAsk[] = [
				"completion_result",
				"resume_completed_task",
				"resume_task",
				"request_limit_reached",
				"followup",
			]
			const mustRequestApprovalTool: ChatTool["tool"][] = ["ask_followup_question", "attempt_completion"]
			if (
				tool &&
				tool.approvalState === "pending" &&
				((this.stateService.alwaysAllowReadOnly && readCommands.includes(tool?.tool as ChatTool["tool"])) ||
					(this.stateService.alwaysAllowWriteOnly &&
						!mustRequestApprovalTool.includes(tool?.tool as ChatTool["tool"])))
			) {
				// update the tool.status
				tool.approvalState = "loading"
			}

			const askMessage: V1ClaudeMessage = {
				ts: askTs,
				type: "ask",
				ask: type,
				text: question ? question : tool ? JSON.stringify(tool) : "",
				v: 1,
				status: tool?.approvalState,
				autoApproved: !!this.stateService.alwaysAllowWriteOnly,
			}
			if (this.stateService.getMessageById(askTs)) {
				this.stateService.updateClaudeMessage(askTs, askMessage)
			} else {
				await this.stateService.addToClaudeMessages(askMessage)
			}
			console.log(`TS: ${askTs}\nWe asked: ${type}\nQuestion: ${question}`)
			this.updateWebview()

			if (this.stateService.alwaysAllowReadOnly && readCommands.includes(tool?.tool as ChatTool["tool"])) {
				resolve({ response: "yesButtonTapped", text: "", images: [] })
				return
			}

			if (
				this.stateService.alwaysAllowWriteOnly &&
				!mustRequestApprovalType.includes(type) &&
				!mustRequestApprovalTool.includes(tool?.tool as ChatTool["tool"])
			) {
				resolve({ response: "yesButtonTapped", text: "", images: [] })
				return
			}

			this.pendingAskResponse = resolve
		})
	}

	public async updateAsk(type: ClaudeAsk, data: AskDetails, askTs: number): Promise<void> {
		const { question, tool } = data
		const askMessage: V1ClaudeMessage = {
			ts: askTs,
			type: "ask",
			ask: type,
			text: question ? question : tool ? JSON.stringify(tool) : "",
			v: 1,
			status: tool?.approvalState,
			autoApproved: !!this.stateService.alwaysAllowWriteOnly,
		}

		await this.stateService?.updateClaudeMessage(askTs, askMessage)
		await this.updateWebview()
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
		if (this.stateService.getMessageById(sayTs)) {
			await this.stateService.updateClaudeMessage(sayTs, sayMessage)
		} else {
			await this.stateService.addToClaudeMessages(sayMessage)
		}
		await this.updateWebview()
		return sayTs
	}

	public async say(type: ClaudeSay, text?: string, images?: string[], sayTs = Date.now()): Promise<number> {
		const sayMessage: ClaudeMessage = {
			ts: sayTs,
			type: "say",
			say: type,
			text: text,
			images,
			isFetching: type === "api_req_started",
			v: 1,
		}

		await this.stateService.addToClaudeMessages(sayMessage)
		await this.updateWebview()
		return sayTs
	}

	public async sayAfter(type: ClaudeSay, target: number, text?: string, images?: string[]): Promise<void> {
		console.log(`Saying after: ${type} ${text}`)
		const sayMessage: ClaudeMessage = {
			ts: Date.now(),
			type: "say",
			say: type,
			text: text,
			images,
			v: 1,
		}

		await this.stateService.addToClaudeAfterMessage(target, sayMessage)
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

	protected async updateWebview(): Promise<void> {
		// TODO: refactor, this is the most important one
		// await this.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
	}
}
