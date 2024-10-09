import * as path from "path"
import { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeAsk, ClaudeMessage, ClaudeSay, isV1ClaudeMessage } from "../../shared/ExtensionMessage"
import { ClaudeAskResponse } from "../../shared/WebviewMessage"
import { combineApiRequests } from "../../shared/combineApiRequests"
import { getApiMetrics } from "../../shared/getApiMetrics"
import { KoduError, koduSSEResponse } from "../../shared/kodu"
import { amplitudeTracker } from "../../utils/amplitude"
import { createStreamDebouncer } from "../../utils/stream-debouncer"
import { StateManager } from "./state-manager"
import { ToolExecutor } from "./tool-executor"
import { ToolInput } from "./tools/types"
import { ToolName, UserContent } from "./types"
import { debounce } from "lodash"
import { ChunkProcessor } from "./chunk-proccess"
import { ClaudeDevProvider } from "../../providers/claude-coder/ClaudeCoderProvider"
import { GitHandler } from "./handlers/git-handler"
import { getCwd } from "./utils"

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

/**
 * @deprecated requires a major refactor this is not suitable for the future.
 */
export class TaskExecutor {
	public state: TaskState = TaskState.IDLE
	public gitHandler: GitHandler
	private stateManager: StateManager
	private toolExecutor: ToolExecutor
	private providerRef: WeakRef<ClaudeDevProvider>
	private currentUserContent: UserContent | null = null
	private currentApiResponse: Anthropic.Messages.Message | null = null
	private currentToolResults: Anthropic.ToolResultBlockParam[] = []
	/**
	 * this is a callback function that will be called when the user responds to an ask question
	 */
	private pendingAskResponse: ((value: AskResponse) => void) | null = null
	private isRequestCancelled: boolean = false
	private abortController: AbortController | null = null
	private consecutiveErrorCount: number = 0

	constructor(stateManager: StateManager, toolExecutor: ToolExecutor, providerRef: WeakRef<ClaudeDevProvider>) {
		this.stateManager = stateManager
		this.toolExecutor = toolExecutor
		this.providerRef = providerRef
		this.gitHandler = new GitHandler()
	}

	public async newMessage(message: UserContent) {
		this.logState("New message")
		this.state = TaskState.WAITING_FOR_API
		this.isRequestCancelled = false
		this.abortController = new AbortController()
		this.currentUserContent = message
		this.say("user_feedback", message[0].type === "text" ? message[0].text : "New message")
		await this.makeClaudeRequest()
	}

	public async startTask(userContent: UserContent): Promise<void> {
		this.logState("Starting task")
		this.state = TaskState.WAITING_FOR_API
		this.currentUserContent = userContent
		this.isRequestCancelled = false
		this.abortController = new AbortController()
		this.consecutiveErrorCount = 0
		await this.makeClaudeRequest()
	}

	public async resumeTask(userContent: UserContent): Promise<void> {
		if (this.state === TaskState.WAITING_FOR_USER) {
			this.logState("Resuming task")
			this.state = TaskState.WAITING_FOR_API
			this.currentUserContent = userContent
			this.isRequestCancelled = false
			this.consecutiveErrorCount = 0
			this.abortController = new AbortController()
			await this.makeClaudeRequest()
		} else {
			this.logError(new Error("Cannot resume task: not in WAITING_FOR_USER state") as TaskError)
		}
	}

	public abortTask(): void {
		this.logState("Aborting task")
		this.abortController?.abort()
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
		// find the last api request
		const lastApiRequest = this.stateManager.state.claudeMessages
			.slice()
			.reverse()
			.find((msg) => msg.type === "say" && msg.say === "api_req_started")
		if (lastApiRequest && isV1ClaudeMessage(lastApiRequest)) {
			await this.stateManager.updateClaudeMessage(lastApiRequest.ts, {
				...lastApiRequest,
				isDone: true,
				isFetching: false,
				errorText: "Request cancelled by user",
				isError: true,
			})
			await this.stateManager.removeEverythingAfterMessage(lastApiRequest.ts)
		}
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
		if (this.consecutiveErrorCount >= 3) {
			await this.ask(
				"resume_task",
				"Claude has encountered an error 3 times in a row. Would you like to resume the task?"
			)
		}

		if (this.stateManager.state.requestCount >= this.stateManager.maxRequestsPerTask) {
			await this.handleRequestLimitReached()
			return
		}

		try {
			this.logState("Making Claude API request")
			const tempHistoryLength = this.stateManager.state.apiConversationHistory.length
			console.log(`[TaskExecutor] tempHistoryLength:`, tempHistoryLength)
			console.log(
				`[TaskExecutor] stateManager.state.apiConversationHistory:`,
				JSON.stringify(this.stateManager.state.apiConversationHistory)
			)
			await this.stateManager.addToApiConversationHistory({ role: "user", content: this.currentUserContent })
			const startedReqId = await this.say(
				"api_req_started",
				JSON.stringify({
					request: this.stateManager.apiManager.createUserReadableRequest(this.currentUserContent),
				})
			)

			const stream = this.stateManager.apiManager.createApiStreamRequest(
				this.stateManager.state.apiConversationHistory,
				this.abortController?.signal
			)

			if (this.isRequestCancelled) {
				this.abortController?.abort()
				this.logState("Request cancelled, ignoring response")
				return
			}

			this.stateManager.state.requestCount++
			this.state = TaskState.PROCESSING_RESPONSE
			await this.processApiResponse(stream, startedReqId)
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

	private async processApiResponse(
		stream: AsyncGenerator<koduSSEResponse, any, unknown>,
		startedReqId: number
	): Promise<void> {
		if (this.state !== TaskState.PROCESSING_RESPONSE || this.isRequestCancelled) {
			return
		}

		this.logState("Processing API response")
		// const { inputTokens, outputTokens } = this.logApiResponse(this.currentApiResponse)
		const assistantResponses: Anthropic.Messages.ContentBlock[] = []
		this.currentToolResults = []
		/**
		 * first create a placeholder say
		 */
		const currentReplyId = await this.say("text", "")
		let textBuffer = ""
		const updateInterval = 5 // milliseconds

		const debouncedUpdate = debounce(async (text: string) => {
			textBuffer = ""
			await this.stateManager.appendToClaudeMessage(currentReplyId, text)
			await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
		}, updateInterval)
		const processor = new ChunkProcessor({
			onImmediateEndOfStream: async (chunk) => {
				if (chunk.code === 1) {
					console.log(`End of stream reached`)
					console.log(`Chunk body:`, chunk.body)
					const { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens } =
						chunk.body.internal
					const updatedMsg: ClaudeMessage = {
						...this.stateManager.getMessageById(startedReqId)!,
						apiMetrics: {
							cost: chunk.body.internal.cost,
							inputTokens,
							outputTokens,
							inputCacheRead: cacheReadInputTokens,
							inputCacheWrite: cacheCreationInputTokens,
						},
						isDone: true,
						isFetching: false,
					}
					await this.stateManager.updateClaudeMessage(startedReqId, updatedMsg)
					await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
				}
				if (chunk.code === -1) {
					// update current request to fail
					const updatedMsg: ClaudeMessage = {
						...this.stateManager.getMessageById(startedReqId)!,
						isDone: true,
						isFetching: false,
						errorText: chunk.body.msg ?? `Internal Server Error`,
						isError: true,
					}
					await this.stateManager.updateClaudeMessage(startedReqId, updatedMsg)
					await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
					throw new KoduError({ code: chunk.body.status ?? 500 })
				}
			},
			onChunk: async (chunk) => {
				if (chunk.code === 1) {
					const { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens } =
						chunk.body.internal
					for (const contentBlock of chunk.body.anthropic.content) {
						// if request was cancelled, stop processing and don't add to history or show in UI
						if (this.isRequestCancelled) {
							console.log(`Request was cancelled, ignoring response`)
							return
						}

						if (contentBlock.type === "text") {
							assistantResponses.push(contentBlock)
						} else if (contentBlock.type === "tool_use") {
							assistantResponses.push(contentBlock)
						}

						// if the request was cancelled after processing a block, return to prevent further processing (ui state + anthropic state)
						if (this.isRequestCancelled) {
							console.log(`Request was cancelled after processing a block`)
							return
						}
						console.log(`[TaskExecutor] assistantResponses:`, assistantResponses)
					}
					if (!this.isRequestCancelled) {
						console.log(`About to call finishProcessingResponse at ${Date.now()}`)
						await this.finishProcessingResponse(assistantResponses, inputTokens, outputTokens)
					}
				}
				if (chunk.code === 2) {
					textBuffer += chunk.body.text
					debouncedUpdate(textBuffer)
				}
				if (chunk.code === 3) {
					const { contentBlock } = chunk.body
					if (contentBlock.type === "tool_use") {
						await this.executeTool(contentBlock)
					}
				}
			},
			onFinalEndOfStream: async (chunk) => {
				console.log("Final processing of end-of-stream chunk:", chunk)
				// Perform final end-of-stream processing
			},
		})

		await processor.processStream(stream)
	}

	private resetState(): void {
		this.state = TaskState.IDLE
		this.abortController?.abort()
		// this.currentUserContent = null
		this.currentApiResponse = null
		this.currentToolResults = []
		this.isRequestCancelled = false
		this.abortController = null
		this.consecutiveErrorCount = 0
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

			await this.onBeforeToolExecution(toolName as ToolName, input)
			const result = await this.toolExecutor.executeTool({
				name: toolName as ToolName,
				input,
				isLastWriteToFile: false,
				ask: this.ask.bind(this),
				say: this.say.bind(this),
			})
			await this.onAfterToolExecution(toolName as ToolName, input)

			console.log(`Tool result:`, result)
			this.currentToolResults.push({ type: "tool_result", tool_use_id: toolUseId, content: result })
			this.state = TaskState.PROCESSING_RESPONSE
		} catch (error) {
			console.error(`Error executing tool: ${toolName}`, error)
			await this.handleToolError(error as TaskError)
		}
	}

	private async onBeforeToolExecution(toolName: ToolName, input: ToolInput): Promise<void> {
		const initTriggers = ["write_to_file", "update_file"]
		// on the first write_to_file tool call, set dirAbsolutePath and initialize repo
		if (initTriggers.includes(toolName)) {
			const state = this.stateManager.state
			const isNotInitialized = !state.dirAbsolutePath || !state.isRepoInitialized

			if (isNotInitialized && input.path) {
				const { historyItem } = await this.providerRef.deref()?.getTaskManager().getTaskWithId(state.taskId)!

				const [baseDir] = input.path.split(path.sep)
				const cwd = this.toolExecutor.options.cwd
				const dirAbsolutePath = path.join(cwd, baseDir)
				if (dirAbsolutePath) {
					historyItem.dirAbsolutePath = dirAbsolutePath
					state.dirAbsolutePath = dirAbsolutePath

					this.providerRef.deref()?.getKoduDev()?.diagnosticsHandler.init(dirAbsolutePath)
				}

				if (!state.isRepoInitialized) {
					const isRepoInitialized = await this.gitHandler.init(dirAbsolutePath)
					historyItem.isRepoInitialized = isRepoInitialized
					state.isRepoInitialized = isRepoInitialized
				}

				await this.providerRef.deref()?.getStateManager().updateTaskHistory(historyItem)
				await this.stateManager.setState(state)
			}
		}
	}

	// say and git commit and dignaostics can happen here
	private async onAfterToolExecution(toolName: ToolName, input: ToolInput): Promise<void> {
		if (toolName === "upsert_task_history") {
			await this.gitHandler.commitChangesOnMilestone(input.summary!)
		}
	}

	/**
	 *
	 * @param assistantResponses The assistant responses that need to be added to the history
	 * @param inputTokens Number of input tokens used in the API request (NOT NEEDED - api manager manually handles this)
	 * @param outputTokens Number of output tokens used in the API request (NOT NEEDED - api manager manually handles this)
	 * @returns
	 */
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
			} else {
				this.state = TaskState.WAITING_FOR_API
				this.currentUserContent = this.currentToolResults
				this.consecutiveErrorCount = 0
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

	/**
	 * @todo test this function
	 * @deprecated
	 */
	private async handleRequestLimitReached(): Promise<void> {
		this.logState("Request limit reached")
		const { response } = await this.ask(
			"request_limit_reached",
			`Claude Coder has reached the maximum number of requests for this task. Would you like to reset the count and allow him to proceed?`
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

	/**
	 * @description currently the ui dosen't know how to handle multiple retries of the same request (original implementation was missing)
	 * @todo make sure this is handled correctly with the ui (original implementation was missing)
	 * @param error The error that occurred during API request
	 */
	private async handleApiError(error: TaskError): Promise<void> {
		this.logError(error)
		console.log(`[TaskExecutor] Error (State: ${this.state}):`, error)
		/**
		 * Pop the last message from the history as it was request that failed
		 */
		this.stateManager.popLastApiConversationMessage()
		// await this.stateManager.addToApiConversationHistory({
		// 	role: "assistant",
		// 	content: [{ type: "text", text: `API request failed: ${error.message}` }],
		// })
		this.consecutiveErrorCount++
		const { response, text } = await this.ask("api_req_failed", error.message)
		if (response === "yesButtonTapped" || response === "messageResponse") {
			// pop last message from the history
			console.log(JSON.stringify(this.stateManager.state.claudeMessages, null, 2))

			await this.say("api_req_retried")
			this.state = TaskState.WAITING_FOR_API
			await this.makeClaudeRequest()
		} else {
			this.state = TaskState.COMPLETED
		}
	}

	/**
	 * @todo make sure this is handled correctly with the ui (original implementation was missing)
	 * @param error The error that occurred during tool execution
	 */
	private async handleToolError(error: TaskError): Promise<void> {
		this.logError(error)
		this.consecutiveErrorCount++
		await this.say("error", `Tool execution failed: ${error.message}`)
		this.state = TaskState.WAITING_FOR_USER
		this.currentUserContent = [
			{
				type: "text",
				text: `A tool execution error occurred: ${error.message}. Please review the error and decide how to proceed.`,
			},
		]
	}

	/**
	 *
	 * @param type The type of message to ask
	 * @param question The question to ask the user
	 * @returns The response from the user
	 */
	public async ask(type: ClaudeAsk, question?: string): Promise<AskResponse> {
		return new Promise((resolve) => {
			const askTs = Date.now()
			this.stateManager.addToClaudeMessages({
				ts: askTs,
				type: "ask",
				ask: type,
				text: question,
				v: 1,
				autoApproved: !!this.stateManager.alwaysAllowWriteOnly,
			})
			console.log(`TS: ${askTs}\nWe asked: ${type}\nQuestion:: ${question}`)
			this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
			const mustRequestApproval: ClaudeAsk[] = [
				"completion_result",
				"resume_completed_task",
				"resume_task",
				"request_limit_reached",
				"followup",
			]
			if (this.stateManager.alwaysAllowWriteOnly && !mustRequestApproval.includes(type)) {
				resolve({ response: "yesButtonTapped", text: "", images: [] })
				this.pendingAskResponse = null
				return
			}
			this.pendingAskResponse = resolve
		})
	}

	/**
	 *
	 * @param type - The type of message to say
	 * @param text - The text to say
	 * @param images - The images to show
	 */
	public async say(type: ClaudeSay, text?: string, images?: string[], sayTs = Date.now()): Promise<number> {
		await this.stateManager.addToClaudeMessages({
			ts: sayTs,
			type: "say",
			say: type,
			text: text,
			images,
			isFetching: type === "api_req_started",
			v: 1,
		})
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
		return sayTs
	}

	/**
	 *
	 * @param type - The type of message to say
	 * @param text - The text to say
	 * @param images - The images to show
	 */
	public async sayAfter(type: ClaudeSay, target: number, text?: string, images?: string[]): Promise<void> {
		console.log(`Saying after: ${type} ${text}`)
		await this.stateManager.addToClaudeAfterMessage(target, {
			ts: Date.now(),
			type: "say",
			say: type,
			text: text,
			images,
			v: 1,
		})
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
	}

	/**
	 *
	 * @param response - The response from the user to the ask question (yes, no, or messageResponse)
	 * @param text - The text in case the response is messageResponse
	 * @param images - The images in case the response is messageResponse
	 */
	public handleAskResponse(response: ClaudeAskResponse, text?: string, images?: string[]): void {
		/**
		 * If there is a pending ask response, call the resolve function with the response
		 */
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
