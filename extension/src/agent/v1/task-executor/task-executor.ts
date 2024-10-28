import { ClaudeAsk, ClaudeMessage, isV1ClaudeMessage } from "../../../shared/ExtensionMessage"
import { ClaudeAskResponse } from "../../../shared/WebviewMessage"
import { KODU_ERROR_CODES, KoduError, koduSSEResponse } from "../../../shared/kodu"
import { StateManager } from "../state-manager"
import { ToolExecutor } from "../tools/tool-executor"
import { ChunkProcessor } from "../chunk-proccess"
import { ExtensionProvider } from "../../../providers/claude-coder/ClaudeCoderProvider"
import { ApiHistoryItem, ToolResponse, UserContent } from "../types"
import { AskDetails, AskResponse, TaskError, TaskState, TaskExecutorUtils } from "./utils"
import { isTextBlock } from "../utils"
import { getErrorMessage } from "../types/errors"
import { AskManager } from "./ask-manager"
import { ChatTool } from "../../../shared/new-tools"

export class TaskExecutor extends TaskExecutorUtils {
	public state: TaskState = TaskState.IDLE
	private toolExecutor: ToolExecutor
	private currentUserContent: UserContent | null = null
	private isRequestCancelled: boolean = false
	private abortController: AbortController | null = null
	private consecutiveErrorCount: number = 0
	private isAborting: boolean = false
	private streamPaused: boolean = false
	private textBuffer: string = ""
	private askManager: AskManager

	constructor(stateManager: StateManager, toolExecutor: ToolExecutor, providerRef: WeakRef<ExtensionProvider>) {
		super(stateManager, providerRef)
		this.toolExecutor = toolExecutor
		this.askManager = new AskManager(stateManager)
	}

	protected getState(): TaskState {
		return this.state
	}

	public async ask(type: ClaudeAsk, data?: AskDetails): Promise<AskResponse> {
		return this.askManager.ask(type, data)
	}

	public async askWithId(type: ClaudeAsk, data?: AskDetails, askTs?: number): Promise<AskResponse> {
		return this.askManager.ask(type, data, askTs)
	}

	public handleAskResponse(response: ClaudeAskResponse, text?: string, images?: string[]): void {
		const lastAskMessage = [...this.stateManager.state.claudeMessages].reverse().find((msg) => msg.type === "ask")
		if (lastAskMessage) {
			this.askManager.handleResponse(lastAskMessage.ts, response, text, images)
		}
	}

	public pauseStream() {
		this.streamPaused = true
	}

	public resumeStream() {
		this.streamPaused = false
	}

	private async flushTextBuffer(currentReplyId: number) {
		if (this.textBuffer.trim()) {
			await this.stateManager.appendToClaudeMessage(currentReplyId, this.textBuffer)
			await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
			this.textBuffer = ""
		}
	}

	public async newMessage(message: UserContent) {
		if (this.isAborting) {
			throw new Error("Cannot start new message while aborting")
		}
		this.logState("New message")
		this.state = TaskState.WAITING_FOR_API
		this.isRequestCancelled = false
		this.abortController = new AbortController()
		this.currentUserContent = message
		await this.say("user_feedback", message[0].type === "text" ? message[0].text : "New message")
		await this.makeClaudeRequest()
	}

	public async startTask(userContent: UserContent): Promise<void> {
		if (this.isAborting) {
			throw new Error("Cannot start task while aborting")
		}
		this.logState("Starting task")
		this.state = TaskState.WAITING_FOR_API
		this.currentUserContent = this.normalizeUserContent(userContent)
		this.isRequestCancelled = false
		this.abortController = new AbortController()
		this.consecutiveErrorCount = 0
		await this.makeClaudeRequest()
	}

	public async resumeTask(userContent: UserContent): Promise<void> {
		if (this.isAborting) {
			throw new Error("Cannot resume task while aborting")
		}
		if (this.state === TaskState.WAITING_FOR_USER) {
			this.logState("Resuming task")
			this.state = TaskState.WAITING_FOR_API
			this.currentUserContent = this.normalizeUserContent(userContent)
			this.isRequestCancelled = false
			this.consecutiveErrorCount = 0
			this.abortController = new AbortController()
			await this.makeClaudeRequest()
		} else {
			this.logError(new Error("Cannot resume task: not in WAITING_FOR_USER state") as TaskError)
		}
	}

	private normalizeUserContent(content: UserContent): UserContent {
		if (content.length === 0 || (content[0]?.type === "text" && !content[0].text?.trim())) {
			return [{ type: "text", text: "Let's continue with the task, from where we left off." }]
		}
		return content
	}

	public async abortTask(): Promise<void> {
		if (this.isAborting) {
			return
		}

		this.isAborting = true
		try {
			this.logState("Aborting task")
			const now = Date.now()

			// First cancel the current request
			await this.cancelCurrentRequest()

			// Then cleanup tool executor
			await this.toolExecutor.abortTask()

			// Finally reset state
			await this.resetState()

			this.logState(`Task aborted in ${Date.now() - now}ms`)
		} finally {
			this.isAborting = false
		}
	}

	private async cancelCurrentRequest(): Promise<void> {
		if (this.isRequestCancelled) {
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

		// find the last api request and tool request
		const lastApiRequest = this.stateManager.state.claudeMessages
			.slice()
			.reverse()
			.find((msg) => msg.type === "say" && msg.say === "api_req_started")

		const lastToolRequest = this.stateManager.state.claudeMessages
			.slice()
			.reverse()
			.find((msg) => {
				if (!isV1ClaudeMessage(msg) || msg.ask !== "tool") {
					return false
				}
				const parsedTool = JSON.parse(msg.text ?? "{}") as ChatTool
				return parsedTool.approvalState !== "error"
			})

		// Update tool request if exists and not already approved
		if (lastToolRequest) {
			const parsedTool = JSON.parse(lastToolRequest.text ?? "{}") as ChatTool
			if (parsedTool.approvalState !== "approved") {
				await this.updateAsk(
					lastToolRequest.ask!,
					{
						tool: {
							...parsedTool,
							approvalState: "error",
							error: "Task was interrupted before this tool call could be completed.",
						},
					},
					lastToolRequest.ts
				)
			}
		}

		// Update API request if exists and not done
		if (lastApiRequest && isV1ClaudeMessage(lastApiRequest) && !lastApiRequest.isDone) {
			await this.stateManager.updateClaudeMessage(lastApiRequest.ts, {
				...lastApiRequest,
				isDone: true,
				isFetching: false,
				errorText: "Request cancelled by user",
				isError: true,
			})
		}

		this.ask("resume_task", {
			question:
				"Task was interrupted before the last response could be generated. Would you like to resume the task?",
		})

		// Update the provider state
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
	}

	public async makeClaudeRequest(): Promise<void> {
		try {
			if (
				this.state !== TaskState.WAITING_FOR_API ||
				!this.currentUserContent ||
				this.isRequestCancelled ||
				this.isAborting
			) {
				return
			}

			// Reset states
			await this.toolExecutor.resetToolState()
			this.isRequestCancelled = false
			this.abortController = new AbortController()
			this.streamPaused = false
			this.textBuffer = ""

			if (this.consecutiveErrorCount >= 3) {
				await this.ask("resume_task", {
					question: "Claude has encountered an error 3 times in a row. Would you like to resume the task?",
				})
			}

			this.logState("Making Claude API request")

			// Add user content to history and start request
			await this.stateManager.addToApiConversationHistory({
				role: "user",
				content: this.currentUserContent,
			})

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

			if (this.isRequestCancelled || this.isAborting) {
				this.abortController?.abort()
				this.logState("Request cancelled, ignoring response")
				return
			}

			this.state = TaskState.PROCESSING_RESPONSE
			await this.processApiResponse(stream, startedReqId)
		} catch (error) {
			if (!this.isRequestCancelled && !this.isAborting) {
				if (error instanceof KoduError) {
					console.log("[TaskExecutor] KoduError:", error)
					if (error.errorCode === KODU_ERROR_CODES.AUTHENTICATION_ERROR) {
						await this.handleApiError(new TaskError({ type: "UNAUTHORIZED", message: error.message }))
						return
					}
					if (error.errorCode === KODU_ERROR_CODES.PAYMENT_REQUIRED) {
						await this.handleApiError(new TaskError({ type: "PAYMENT_REQUIRED", message: error.message }))
						return
					}
					await this.handleApiError(new TaskError({ type: "API_ERROR", message: error.message }))
					return
				}
				// @ts-expect-error
				await this.handleApiError(new TaskError({ type: "UNKNOWN_ERROR", message: error.message }))
			} else {
				console.log("[TaskExecutor] Request was cancelled, ignoring error")
			}
		}
	}

	private async processApiResponse(
		stream: AsyncGenerator<koduSSEResponse, any, unknown>,
		startedReqId: number
	): Promise<void> {
		if (this.state !== TaskState.PROCESSING_RESPONSE || this.isRequestCancelled || this.isAborting) {
			return
		}

		try {
			this.logState("Processing API response")
			const currentReplyId = await this.say("text", "")
			const apiHistoryItem: ApiHistoryItem = {
				role: "assistant",
				ts: startedReqId,
				content: [
					{
						type: "text",
						text: "the response was intrupted in the middle of processing",
					},
				],
			}
			await this.stateManager.addToApiConversationHistory(apiHistoryItem)

			const processor = new ChunkProcessor({
				onImmediateEndOfStream: async (chunk) => {
					if (this.isRequestCancelled || this.isAborting) {
						return
					}

					if (chunk.code === 1) {
						const { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens } =
							chunk.body.internal
						await this.stateManager.updateClaudeMessage(startedReqId, {
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
						})
						await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
					}

					if (chunk.code === -1) {
						await this.stateManager.updateClaudeMessage(startedReqId, {
							...this.stateManager.getMessageById(startedReqId)!,
							isDone: true,
							isFetching: false,
							errorText: chunk.body.msg ?? "Internal Server Error",
							isError: true,
						})
						await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
						throw new KoduError({ code: chunk.body.status ?? 500 })
					}
				},

				onChunk: async (chunk) => {
					if (this.isRequestCancelled || this.isAborting) {
						return
					}

					if (chunk.code === 2) {
						// Update API history first
						if (Array.isArray(apiHistoryItem.content) && isTextBlock(apiHistoryItem.content[0])) {
							apiHistoryItem.content[0].text =
								apiHistoryItem.content[0].text ===
								"the response was intrupted in the middle of processing"
									? chunk.body.text
									: apiHistoryItem.content[0].text + chunk.body.text
							await this.stateManager.updateApiHistoryItem(startedReqId, apiHistoryItem)
						}

						// Process chunk only if stream is not paused
						if (!this.streamPaused) {
							// Process for tool use and get non-XML text
							const nonXMLText = await this.toolExecutor.processToolUse(chunk.body.text)

							// If we got non-XML text, add it to buffer
							if (nonXMLText) {
								this.textBuffer += nonXMLText
								// Only flush buffer if we're not paused
								await this.flushTextBuffer(currentReplyId)
							}

							// If tool processing started, pause the stream
							if (this.toolExecutor.hasActiveTools()) {
								this.pauseStream()
								// Wait for tool processing to complete
								await this.toolExecutor.waitForToolProcessing()
								// Resume stream after tool processing
								this.resumeStream()
							}
						}
					}
				},

				onFinalEndOfStream: async () => {
					if (this.isRequestCancelled || this.isAborting) {
						return
					}

					// Ensure all tools are processed
					await this.toolExecutor.waitForToolProcessing()
					// Flush any remaining text
					await this.flushTextBuffer(currentReplyId)

					await this.finishProcessingResponse(apiHistoryItem)
				},
			})

			await processor.processStream(stream)
		} catch (error) {
			if (this.isRequestCancelled || this.isAborting) {
				throw error
			}
			throw error
		}
	}

	private async resetState() {
		this.abortController?.abort()
		this.isRequestCancelled = false
		this.abortController = null
		this.consecutiveErrorCount = 0
		this.state = TaskState.WAITING_FOR_USER
		this.streamPaused = false
		this.textBuffer = ""
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
	}

	private async finishProcessingResponse(assistantResponses: ApiHistoryItem): Promise<void> {
		this.logState("Finishing response processing")
		if (this.isRequestCancelled || this.isAborting) {
			return
		}

		// Ensure no empty content in API history
		if (
			!assistantResponses.content.length ||
			(isTextBlock(assistantResponses.content[0]) && !assistantResponses.content[0].text.trim())
		) {
			if (assistantResponses.ts) {
				await this.stateManager.updateApiHistoryItem(assistantResponses.ts, {
					role: "assistant",
					content: [{ type: "text", text: "Failed to generate a response, please try again." }],
				})
			}
		}

		const currentToolResults = await this.toolExecutor.getToolResults()

		if (currentToolResults.length > 0) {
			const completionAttempted = currentToolResults.find((result) => result?.name === "attempt_completion")

			if (completionAttempted) {
				await this.stateManager.addToApiConversationHistory({
					role: "user",
					content: completionAttempted.result,
				})
				await this.stateManager.addToApiConversationHistory({
					role: "assistant",
					content: [{ type: "text", text: "Task completed successfully." }],
				})
				this.state = TaskState.COMPLETED
			} else {
				this.state = TaskState.WAITING_FOR_API
				this.currentUserContent = currentToolResults.flatMap((result) => {
					if (typeof result.result === "string") {
						return [{ type: "text", text: result.result }]
					}
					return result.result
				})
				await this.makeClaudeRequest()
			}
		} else {
			this.state = TaskState.WAITING_FOR_API
			this.currentUserContent = [
				{
					type: "text",
					text: "You must use a tool to proceed. Either use attempt_completion if you've completed the task, or ask_followup_question if you need more information.",
				},
			]
			await this.makeClaudeRequest()
		}
	}

	private async handleApiError(error: TaskError): Promise<void> {
		this.logError(error)
		console.log(`[TaskExecutor] Error (State: ${this.state}):`, error)
		await this.toolExecutor.resetToolState()

		const lastAssistantMessage = this.stateManager.state.apiConversationHistory.at(-1)
		if (lastAssistantMessage?.role === "assistant" && lastAssistantMessage.ts) {
			if (typeof lastAssistantMessage.content === "string") {
				lastAssistantMessage.content = [{ type: "text", text: lastAssistantMessage.content }]
			}
			if (Array.isArray(lastAssistantMessage.content) && isTextBlock(lastAssistantMessage.content[0])) {
				lastAssistantMessage.content[0].text =
					lastAssistantMessage.content[0].text.trim() ||
					"An error occurred in the generation of the response. Please try again."
			}
			await this.stateManager.updateApiHistoryItem(lastAssistantMessage.ts, lastAssistantMessage)
		}

		this.consecutiveErrorCount++
		if (error.type === "PAYMENT_REQUIRED" || error.type === "UNAUTHORIZED") {
			this.state = TaskState.IDLE
			await this.say(error.type === "PAYMENT_REQUIRED" ? "payment_required" : "unauthorized", error.message)
			return
		}

		const { response } = await this.ask("api_req_failed", { question: error.message })
		if (response === "yesButtonTapped" || response === "messageResponse") {
			await this.say("api_req_retried")
			this.state = TaskState.WAITING_FOR_API
			await this.makeClaudeRequest()
		} else {
			this.state = TaskState.COMPLETED
		}
	}
}
