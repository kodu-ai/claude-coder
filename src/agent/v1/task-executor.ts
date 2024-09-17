import { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeAsk, ClaudeSay } from "../../shared/ExtensionMessage"
import { ClaudeAskResponse } from "../../shared/WebviewMessage"
import { ToolExecutor } from "./tool-executor"
import { UserContent, ToolResponse, ToolName } from "./types"
import { StateManager } from "./state-manager"
import { KoduError } from "../../shared/kodu"
import { amplitudeTracker } from "../../utils/amplitude"
import { getApiMetrics } from "../../shared/getApiMetrics"
import { combineApiRequests } from "../../shared/combineApiRequests"
import { ToolInput } from "./tools/types"
import { ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages.mjs"
import { formatContentBlockToMarkdown } from "../../utils/extract-markdown"
import { KoduDev } from "."
import { findLastIndex } from "../../utils"
import { formatImagesIntoBlocks } from "./utils"

export enum TaskState {
	IDLE = "IDLE",
	WAITING_FOR_API = "WAITING_FOR_API",
	PROCESSING_RESPONSE = "PROCESSING_RESPONSE",
	EXECUTING_TOOL = "EXECUTING_TOOL",
	WAITING_FOR_USER = "WAITING_FOR_USER",
	COMPLETED = "COMPLETED",
	ABORTED = "ABORTED",
}

class TaskError extends Error {
	type: "API_ERROR" | "TOOL_ERROR" | "USER_ABORT" | "UNKNOWN_ERROR"
	constructor({
		type,
		message,
	}: {
		type: "API_ERROR" | "TOOL_ERROR" | "USER_ABORT" | "UNKNOWN_ERROR"
		message: string
	}) {
		super(message)
		this.type = type
	}
}

export class TaskExecutor {
	public state: TaskState = TaskState.IDLE
	private stateManager: StateManager
	private toolExecutor: ToolExecutor
	private koduDev: KoduDev
	private currentUserContent: UserContent | null = null
	private currentApiResponse: Anthropic.Messages.Message | null = null
	private currentToolResults: Anthropic.ToolResultBlockParam[] = []
	private pendingAskResponse: ((value: AskResponse) => void) | null = null
	private isRequestCancelled: boolean = false
	private abortController: AbortController | null = null
	private consecutiveMistakeCount: number = 0

	constructor(stateManager: StateManager, toolExecutor: ToolExecutor, koduDev: KoduDev) {
		this.stateManager = stateManager
		this.toolExecutor = toolExecutor
		this.koduDev = koduDev
	}

	private incrementConsecutiveMistakeCount(): void {
		this.consecutiveMistakeCount++
	}

	private resetConsecutiveMistakeCount(): void {
		this.consecutiveMistakeCount = 0
	}

	public async newMessage(message: UserContent) {
		this.logState("New message")
		this.state = TaskState.WAITING_FOR_API
		this.isRequestCancelled = false
		this.abortController = new AbortController()
		this.currentUserContent = message
		this.say("user_feedback", message[0].type === "text" ? message[0].text : "New message")
		this.resetConsecutiveMistakeCount()
		await this.makeClaudeRequest()
	}

	public async startTask(userContent: UserContent): Promise<void> {
		this.logState("Starting task")
		this.state = TaskState.WAITING_FOR_API
		this.currentUserContent = userContent
		this.isRequestCancelled = false
		this.abortController = new AbortController()
		this.resetConsecutiveMistakeCount()
		await this.makeClaudeRequest()
	}

	public async resumeTask(userContent: UserContent): Promise<void> {
		if (this.state === TaskState.WAITING_FOR_USER) {
			this.logState("Resuming task")
			this.state = TaskState.WAITING_FOR_API
			this.currentUserContent = userContent
			this.isRequestCancelled = false
			this.abortController = new AbortController()
			this.resetConsecutiveMistakeCount()
			await this.makeClaudeRequest()
		} else {
			this.logError(new Error("Cannot resume task: not in WAITING_FOR_USER state") as TaskError)
			this.incrementConsecutiveMistakeCount()
		}
	}

	public abortTask(): void {
		this.logState("Aborting task")
		this.resetState()
	}

	public async cancelCurrentRequest(): Promise<void> {
		if (
			this.isRequestCancelled ||
			this.state === TaskState.IDLE ||
			this.state === TaskState.COMPLETED ||
			this.state === TaskState.ABORTED
		) {
			return // Prevent multiple cancellations
		}

		// check if this is the first message
		if (this.stateManager.state.claudeMessages.length === 2) {
			// cant cancel the first message
			return
		}
		this.logState("Cancelling current request")

		this.isRequestCancelled = true
		this.abortController?.abort()
		this.state = TaskState.ABORTED
		// Immediately update UI
		this.stateManager.popLastClaudeMessage()
		await this.ask("followup", "The current request has been cancelled. Would you like to ask a new question ?")
		// Update the provider state
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
	}

	public async makeClaudeRequest(): Promise<void> {
		console.log(`[TaskExecutor] makeClaudeRequest (State: ${this.state})`)
		console.log(`[TaskExecutor] makeClaudeRequest (isRequestCancelled: ${this.isRequestCancelled})`)
		console.log(`[TaskExecutor] makeClaudeRequest (currentUserContent: ${JSON.stringify(this.currentUserContent)})`)
		if (this.state !== TaskState.WAITING_FOR_API || !this.currentUserContent || this.isRequestCancelled) {
			return
		}

		if (this.stateManager.state.requestCount >= this.stateManager.maxRequestsPerTask) {
			await this.handleRequestLimitReached()
			return
		}

		if (this.consecutiveMistakeCount >= 3) {
			const { response, text, images } = await this.ask(
				"mistake_limit_reached",
				`This may indicate a failure in his thought process or inability to use a tool properly, which can be mitigated with some user guidance (e.g. "Try breaking down the task into smaller steps").`
			)
			if (response === "messageResponse") {
				this.currentUserContent.push(
					...[
						{
							type: "text",
							text: `You seem to be having trouble proceeding. The user has provided the following feedback to help guide you:\n<feedback>\n${text}\n</feedback>`,
						} as Anthropic.Messages.TextBlockParam,
						...formatImagesIntoBlocks(images),
					]
				)
			}
			this.resetConsecutiveMistakeCount()
		}

		// getting verbose details is an expensive operation, it uses globby to top-down build file structure of project which for large projects can take a few seconds
		// for the best UX we show a placeholder api_req_started message with a loading spinner as this happens
		await this.say(
			"api_req_started",
			JSON.stringify({
				request:
					this.currentUserContent
						.map((block) =>
							formatContentBlockToMarkdown(block, this.stateManager.state.apiConversationHistory)
						)
						.join("\n\n") + "\n\n<environment_details>\nLoading...\n</environment_details>",
			})
		)

		// potentially expensive operation
		// if this is the first request, we want to get the environment details + file details
		const environmentDetails = await this.koduDev.getEnvironmentDetails(this.stateManager.state.requestCount === 0)

		// add environment details as its own text block, separate from tool results
		this.currentUserContent.push({ type: "text", text: environmentDetails })

		await this.stateManager.addToApiConversationHistory({ role: "user", content: this.currentUserContent })

		// since we sent off a placeholder api_req_started message to update the webview while waiting to actually start the API request (to load potential details for example), we need to update the text of that message
		const lastApiReqIndex = findLastIndex(
			this.stateManager.state.claudeMessages,
			(m) => m.say === "api_req_started"
		)
		this.stateManager.state.claudeMessages[lastApiReqIndex].text = JSON.stringify({
			request: this.currentUserContent
				.map((block) => formatContentBlockToMarkdown(block, this.stateManager.state.apiConversationHistory))
				.join("\n\n"),
		})
		await this.stateManager.saveClaudeMessages()
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()

		try {
			this.logState("Making Claude API request")
			const tempHistoryLength = this.stateManager.state.apiConversationHistory.length
			console.log(`[TaskExecutor] tempHistoryLength:`, tempHistoryLength)
			console.log(
				`[TaskExecutor] stateManager.state.apiConversationHistory:`,
				JSON.stringify(this.stateManager.state.apiConversationHistory)
			)

			const response = await this.stateManager.apiManager.createApiRequest(
				this.stateManager.state.apiConversationHistory,
				this.abortController?.signal
			)
			const inputTokens = response.usage.input_tokens
			const outputTokens = response.usage.output_tokens
			const cacheCreationInputTokens = (response as any).usage?.cache_creation_input_tokens
			const cacheReadInputTokens = (response as any).usage?.cache_read_input_tokens
			const apiCost = this.stateManager.apiManager.calculateApiCost(
				inputTokens,
				outputTokens,
				cacheCreationInputTokens,
				cacheReadInputTokens
			)
			amplitudeTracker.taskRequest({
				taskId: this.stateManager.state.taskId,
				model: this.stateManager.apiManager.getModelId(),
				apiCost: apiCost,
				inputTokens,
				cacheReadTokens: cacheReadInputTokens,
				cacheWriteTokens: cacheCreationInputTokens,
				outputTokens,
			})

			if (this.isRequestCancelled) {
				this.logState("Request cancelled, ignoring response")
				return
			}

			this.currentApiResponse = response
			this.stateManager.state.requestCount++
			this.state = TaskState.PROCESSING_RESPONSE
			await this.processApiResponse()
		} catch (error) {
			if (!this.isRequestCancelled) {
				// if it's a KoduError, it's an error from the API (can get anthropic error or network error)
				if (error instanceof KoduError) {
					console.log(`[TaskExecutor] KoduError:`, error)
					await this.handleApiError(new TaskError({ type: "API_ERROR", message: error.message }))
					return
				}
				await this.handleApiError(new TaskError({ type: "UNKNOWN_ERROR", message: error.message }))
			} else {
				console.log(`[TaskExecutor] Request was cancelled, ignoring error`)
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
			// if request was cancelled, stop processing and don't add to history or show in UI
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

			// if the request was cancelled after processing a block, return to prevent further processing (ui state + anthropic state)
			if (this.isRequestCancelled) {
				console.log(`Request was cancelled after processing a block`)
				return
			}
		}
		console.log(`[TaskExecutor] assistantResponses:`, assistantResponses)
		if (!this.isRequestCancelled) {
			console.log(`About to call finishProcessingResponse`)
			await this.finishProcessingResponse(assistantResponses, inputTokens, outputTokens)
		}
	}

	private resetState(): void {
		this.state = TaskState.IDLE
		this.currentApiResponse = null
		this.currentToolResults = []
		this.isRequestCancelled = false
		this.abortController = null
		this.resetConsecutiveMistakeCount()
		this.logState("State reset due to request cancellation")
	}

	private async executeTool(toolUseBlock: Anthropic.Messages.ToolUseBlock): Promise<void> {
		const toolName = toolUseBlock.name
		const input = toolUseBlock.input as ToolInput
		const toolUseId = toolUseBlock.id

		this.logState(`Executing tool: ${toolName}`)
		try {
			this.state = TaskState.EXECUTING_TOOL
			if (toolName === "attempt_completion") {
				const combinedMessages = combineApiRequests(this.stateManager.state.claudeMessages)
				const metrics = getApiMetrics(combinedMessages)

				console.log(`[TaskExecutor] Task completed. Metrics:`, metrics)
				amplitudeTracker.taskComplete({
					taskId: this.stateManager.state.taskId,
					totalCost: metrics.totalCost,
					totalCacheReadTokens: metrics.totalCacheReads ?? 0,
					totalCacheWriteTokens: metrics.totalCacheWrites ?? 0,
					totalOutputTokens: metrics.totalTokensOut,
					totalInputTokens: metrics.totalTokensIn,
				})
			}
			const result = await this.toolExecutor.executeTool({
				name: toolName as ToolName,
				input,
				isLastWriteToFile: false,
				ask: this.ask.bind(this),
				say: this.say.bind(this),
			})

			console.log(`Tool result:`, result)
			this.currentToolResults.push({ type: "tool_result", tool_use_id: toolUseId, content: result })
			this.state = TaskState.PROCESSING_RESPONSE
			this.resetConsecutiveMistakeCount()
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
			console.log(`[TaskExecutor] assistantResponses:`, assistantResponses)
			await this.stateManager.addToApiConversationHistory({ role: "assistant", content: assistantResponses })
		} else {
			await this.say("error", "Unexpected Error: No assistant messages were found in the API response")
			await this.stateManager.addToApiConversationHistory({
				role: "assistant",
				content: [{ type: "text", text: "Failure: I did not have a response to provide." }],
			})
			this.incrementConsecutiveMistakeCount()
		}
		if (this.currentToolResults.length > 0) {
			console.log(`[TaskExecutor] assistantResponses:`, assistantResponses)
			const completionAttempted = this.currentToolResults.some(
				(result) =>
					result.content === "" &&
					assistantResponses.some(
						(response) => response.type === "tool_use" && response.name === "attempt_completion"
					)
			)
			console.log(`[TaskExecutor] Completion attempted:`, completionAttempted)
			console.log(JSON.stringify(this.currentToolResults, null, 2))

			if (completionAttempted) {
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
				this.resetConsecutiveMistakeCount()
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
		console.log(`[TaskExecutor] Error (State: ${this.state}):`, error)
		this.stateManager.popLastApiConversationMessage()
		const { response, text } = await this.ask("api_req_failed", error.message)
		if (response === "yesButtonTapped" || response === "messageResponse") {
			console.log(JSON.stringify(this.stateManager.state.claudeMessages, null, 2))
			await this.say("api_req_retried")
			this.state = TaskState.WAITING_FOR_API
			await this.makeClaudeRequest()
		} else {
			this.state = TaskState.COMPLETED
		}
		this.incrementConsecutiveMistakeCount()
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
		this.incrementConsecutiveMistakeCount()
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
				cost: this.stateManager.apiManager.calculateApiCost(
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
			this.stateManager.addToClaudeMessages({
				ts: askTs,
				type: "ask",
				ask: type,
				text: question,
				autoApproved: !!this.stateManager.alwaysAllowWriteOnly,
			})
			console.log(`TS: ${askTs}\nWe asked: ${type}\nQuestion:: ${question}`)
			this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
			const mustRequestApproval = [
				"completion_result",
				"resume_completed_task",
				"resume_task",
				"request_limit_reached",
			]
			if (this.stateManager.alwaysAllowWriteOnly && !mustRequestApproval.includes(type)) {
				resolve({ response: "yesButtonTapped", text: "", images: [] })
				this.pendingAskResponse = null
				return
			}
			this.pendingAskResponse = resolve
		})
	}

	public async say(type: ClaudeSay, text?: string, images?: string[]): Promise<void> {
		const sayTs = Date.now()
		await this.stateManager.addToClaudeMessages({ ts: sayTs, type: "say", say: type, text: text, images })
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
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
