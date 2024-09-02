import { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeAsk, ClaudeSay } from "../../shared/ExtensionMessage"
import { ClaudeAskResponse } from "../../shared/WebviewMessage"
import { ApiManager } from "../api-handler"
import { ToolExecutor } from "./tool-executor"
import { UserContent, ToolResponse, ToolName } from "../types"
import { StateManager } from "./state-manager"

enum TaskState {
	IDLE = "IDLE",
	WAITING_FOR_API = "WAITING_FOR_API",
	PROCESSING_RESPONSE = "PROCESSING_RESPONSE",
	EXECUTING_TOOL = "EXECUTING_TOOL",
	WAITING_FOR_USER = "WAITING_FOR_USER",
	COMPLETED = "COMPLETED",
	ABORTED = "ABORTED",
}

interface TaskError extends Error {
	type: "API_ERROR" | "TOOL_ERROR" | "USER_ABORT" | "UNKNOWN_ERROR"
}

export class TaskExecutor {
	private state: TaskState = TaskState.IDLE
	private stateManager: StateManager
	private apiManager: ApiManager
	private toolExecutor: ToolExecutor
	private currentUserContent: UserContent | null = null
	private currentApiResponse: Anthropic.Messages.Message | null = null
	private currentToolResults: Anthropic.ToolResultBlockParam[] = []
	private pendingAskResponse: ((value: AskResponse) => void) | null = null
	private isRequestCancelled: boolean = false
	private abortController: AbortController | null = null

	constructor(stateManager: StateManager, apiManager: ApiManager, toolExecutor: ToolExecutor) {
		this.stateManager = stateManager
		this.apiManager = apiManager
		this.toolExecutor = toolExecutor
	}

	public async startTask(userContent: UserContent): Promise<void> {
		this.logState("Starting task")
		this.state = TaskState.WAITING_FOR_API
		this.currentUserContent = userContent
		this.isRequestCancelled = false
		this.abortController = new AbortController()
		await this.makeClaudeRequest()
	}

	public async resumeTask(userContent: UserContent): Promise<void> {
		if (this.state === TaskState.WAITING_FOR_USER) {
			this.logState("Resuming task")
			this.state = TaskState.WAITING_FOR_API
			this.currentUserContent = userContent
			this.isRequestCancelled = false
			this.abortController = new AbortController()
			await this.makeClaudeRequest()
		} else {
			this.logError(new Error("Cannot resume task: not in WAITING_FOR_USER state") as TaskError)
		}
	}

	public abortTask(): void {
		this.logState("Aborting task")
		this.cancelCurrentRequest()
	}

	public async cancelCurrentRequest(): Promise<void> {
		if (this.isRequestCancelled) {
			return // Prevent multiple cancellations
		}

		this.logState("Cancelling current request")
		this.isRequestCancelled = true
		this.abortController?.abort()
		this.stateManager.popLastClaudeMessage()

		// Immediately update UI
		await this.say("error", "Request cancelled by user")

		// Reset state
		this.resetState()

		// Update the provider state
		await this.stateManager.providerRef.deref()?.postStateToWebview()
	}

	private async makeClaudeRequest(): Promise<void> {
		if (this.state !== TaskState.WAITING_FOR_API || !this.currentUserContent || this.isRequestCancelled) {
			return
		}

		if (this.stateManager.state.requestCount >= this.stateManager.maxRequestsPerTask) {
			await this.handleRequestLimitReached()
			return
		}

		try {
			this.logState("Making Claude API request")
			const tempHistoryLength = this.stateManager.state.apiConversationHistory.length
			await this.stateManager.addToApiConversationHistory({ role: "user", content: this.currentUserContent })
			await this.say(
				"api_req_started",
				JSON.stringify({ request: this.apiManager.createUserReadableRequest(this.currentUserContent) })
			)

			const response = await this.apiManager.createApiRequest(
				this.stateManager.state.apiConversationHistory,
				this.abortController?.signal
			)

			if (this.isRequestCancelled) {
				this.logState("Request cancelled, ignoring response")
				this.stateManager.state.apiConversationHistory.splice(tempHistoryLength)
				return
			}

			this.currentApiResponse = response
			this.stateManager.state.requestCount++
			this.state = TaskState.PROCESSING_RESPONSE
			await this.processApiResponse()
		} catch (error) {
			if (!this.isRequestCancelled) {
				await this.handleApiError(error as TaskError)
			}
		}
	}

	private async processApiResponse(): Promise<void> {
		if (this.state !== TaskState.PROCESSING_RESPONSE || !this.currentApiResponse || this.isRequestCancelled) {
			return
		}

		this.logState("Processing API response")
		const { inputTokens, outputTokens } = this.logApiResponse(this.currentApiResponse)
		const assistantResponses: Anthropic.Messages.ContentBlock[] = []
		this.currentToolResults = []

		for (const contentBlock of this.currentApiResponse.content) {
			if (this.isRequestCancelled) {
				return
			}

			if (contentBlock.type === "text") {
				assistantResponses.push(contentBlock)
				await this.say("text", contentBlock.text)
			} else if (contentBlock.type === "tool_use") {
				assistantResponses.push(contentBlock)
				await this.executeTool(contentBlock)
			}

			if (this.isRequestCancelled) {
				return
			}
		}

		if (!this.isRequestCancelled) {
			await this.finishProcessingResponse(assistantResponses, inputTokens, outputTokens)
		}
	}

	private resetState(): void {
		this.state = TaskState.IDLE
		this.currentUserContent = null
		this.currentApiResponse = null
		this.currentToolResults = []
		this.isRequestCancelled = false
		this.abortController = null
		this.logState("State reset due to request cancellation")
	}

	private async executeTool(toolUseBlock: Anthropic.Messages.ToolUseBlock): Promise<void> {
		const toolName = toolUseBlock.name
		const toolInput = toolUseBlock.input
		const toolUseId = toolUseBlock.id

		this.logState(`Executing tool: ${toolName}`)
		try {
			this.state = TaskState.EXECUTING_TOOL
			const result = await this.toolExecutor.executeTool(
				toolName as ToolName,
				toolInput,
				false,
				this.ask.bind(this),
				this.say.bind(this)
			)
			this.currentToolResults.push({ type: "tool_result", tool_use_id: toolUseId, content: result })
			this.state = TaskState.PROCESSING_RESPONSE
		} catch (error) {
			await this.handleToolError(error as TaskError)
		}
	}

	private async finishProcessingResponse(
		assistantResponses: Anthropic.Messages.ContentBlock[],
		inputTokens: number,
		outputTokens: number
	): Promise<void> {
		this.logState("Finishing response processing")
		if (this.isRequestCancelled) {
			return
		}

		if (assistantResponses.length > 0) {
			await this.stateManager.addToApiConversationHistory({ role: "assistant", content: assistantResponses })
		} else {
			await this.say("error", "Unexpected Error: No assistant messages were found in the API response")
			await this.stateManager.addToApiConversationHistory({
				role: "assistant",
				content: [{ type: "text", text: "Failure: I did not have a response to provide." }],
			})
		}
		if (this.currentToolResults.length > 0) {
			const completionAttempted = this.currentToolResults.some(
				(result) =>
					result.content === "" &&
					assistantResponses.some(
						(response) => response.type === "tool_use" && response.name === "attempt_completion"
					)
			)

			if (completionAttempted) {
				this.state = TaskState.COMPLETED
				await this.stateManager.addToApiConversationHistory({ role: "user", content: this.currentToolResults })
				await this.stateManager.addToApiConversationHistory({
					role: "assistant",
					content: [
						{
							type: "text",
							text: "I am pleased you are satisfied with the result. Do you have a new task for me?",
						},
					],
				})
			} else {
				this.state = TaskState.WAITING_FOR_API
				this.currentUserContent = this.currentToolResults
				await this.makeClaudeRequest()
			}
		} else {
			this.state = TaskState.WAITING_FOR_USER
			this.currentUserContent = [
				{
					type: "text",
					text: "If you have completed the user's task, use the attempt_completion tool. If you require additional information from the user, use the ask_followup_question tool. Otherwise, if you have not completed the task and do not need additional information, then proceed with the next step of the task. (This is an automated message, so do not respond to it conversationally.)",
				},
			]
		}
	}

	private async handleRequestLimitReached(): Promise<void> {
		this.logState("Request limit reached")
		const { response } = await this.ask(
			"request_limit_reached",
			`Claude Dev has reached the maximum number of requests for this task. Would you like to reset the count and allow him to proceed?`
		)
		if (response === "yesButtonTapped") {
			this.stateManager.state.requestCount = 0
			this.state = TaskState.WAITING_FOR_API
			await this.makeClaudeRequest()
		} else {
			await this.stateManager.addToApiConversationHistory({
				role: "assistant",
				content: [
					{
						type: "text",
						text: "Failure: I have reached the request limit for this task. Do you have a new task for me?",
					},
				],
			})
			this.state = TaskState.COMPLETED
		}
	}

	private async handleApiError(error: TaskError): Promise<void> {
		this.logError(error)
		const { response } = await this.ask("api_req_failed", error.message)
		if (response === "yesButtonTapped" || response === "messageResponse") {
			await this.say("api_req_retried")
			this.state = TaskState.WAITING_FOR_API
			await this.makeClaudeRequest()
		} else {
			this.state = TaskState.COMPLETED
		}
	}

	private async handleToolError(error: TaskError): Promise<void> {
		this.logError(error)
		await this.say("error", `Tool execution failed: ${error.message}`)
		this.state = TaskState.WAITING_FOR_USER
		this.currentUserContent = [
			{
				type: "text",
				text: `A tool execution error occurred: ${error.message}. Please review the error and decide how to proceed.`,
			},
		]
	}

	private logApiResponse(response: Anthropic.Messages.Message): { inputTokens: number; outputTokens: number } {
		const inputTokens = response.usage.input_tokens
		const outputTokens = response.usage.output_tokens
		const cacheCreationInputTokens = (response as any).usage?.cache_creation_input_tokens
		const cacheReadInputTokens = (response as any).usage?.cache_read_input_tokens

		this.say(
			"api_req_finished",
			JSON.stringify({
				tokensIn: inputTokens,
				tokensOut: outputTokens,
				cacheWrites: cacheCreationInputTokens,
				cacheReads: cacheReadInputTokens,
				cost: this.apiManager.calculateApiCost(
					inputTokens,
					outputTokens,
					cacheCreationInputTokens,
					cacheReadInputTokens
				),
			})
		)

		return { inputTokens, outputTokens }
	}

	public async ask(type: ClaudeAsk, question?: string): Promise<AskResponse> {
		return new Promise((resolve) => {
			const askTs = Date.now()
			this.stateManager.addToClaudeMessages({ ts: askTs, type: "ask", ask: type, text: question })
			console.log(`TS: ${askTs}\nWe asked: ${type}\nQuestion:: ${question}`)
			this.stateManager.providerRef.deref()?.postStateToWebview()
			this.pendingAskResponse = resolve
		})
	}

	public async say(type: ClaudeSay, text?: string, images?: string[]): Promise<void> {
		const sayTs = Date.now()
		await this.stateManager.addToClaudeMessages({ ts: sayTs, type: "say", say: type, text: text, images })
		await this.stateManager.providerRef.deref()?.postStateToWebview()
	}

	public handleAskResponse(response: ClaudeAskResponse, text?: string, images?: string[]): void {
		if (this.pendingAskResponse) {
			this.pendingAskResponse({ response, text, images })
			this.pendingAskResponse = null
		}
	}

	private logState(message: string): void {
		console.log(`[TaskExecutor] ${message} (State: ${this.state})`)
	}

	private logError(error: TaskError): void {
		console.error(`[TaskExecutor] Error (State: ${this.state}):`, error)
	}
}

export type AskResponse = {
	response: ClaudeAskResponse
	text?: string
	images?: string[]
}
