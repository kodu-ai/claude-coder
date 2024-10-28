import { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeMessage, isV1ClaudeMessage } from "../../../shared/ExtensionMessage"
import { ClaudeAskResponse } from "../../../shared/WebviewMessage"
import { KODU_ERROR_CODES, KoduError, koduSSEResponse } from "../../../shared/kodu"
import { StateManager } from "../state-manager"
import { ToolExecutor } from "../tools/tool-executor"
import { ChunkProcessor } from "../chunk-proccess"
import { ExtensionProvider } from "../../../providers/claude-coder/ClaudeCoderProvider"
import { ApiHistoryItem, ToolResponse, UserContent } from "../types"
import { debounce } from "lodash"
import { TaskError, TaskExecutorUtils, TaskState } from "./utils"
import { ChatTool } from "../../../shared/new-tools"
import { isTextBlock } from "../utils"

export class TaskExecutor extends TaskExecutorUtils {
	public state: TaskState = TaskState.IDLE
	public toolExecutor: ToolExecutor
	private currentUserContent: UserContent | null = null
	private isRequestCancelled: boolean = false
	private abortController: AbortController | null = null
	private consecutiveErrorCount: number = 0
	private isAborting: boolean = false

	constructor(stateManager: StateManager, toolExecutor: ToolExecutor, providerRef: WeakRef<ExtensionProvider>) {
		super(stateManager, providerRef)
		this.toolExecutor = toolExecutor
	}
	protected getState(): TaskState {
		return this.state
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
		this.say("user_feedback", message[0].type === "text" ? message[0].text : "New message")
		await this.makeClaudeRequest()
	}

	public async startTask(userContent: UserContent): Promise<void> {
		if (this.isAborting) {
			throw new Error("Cannot start task while aborting")
		}
		this.logState("Starting task")
		this.state = TaskState.WAITING_FOR_API
		if (userContent.length === 0) {
			userContent = [
				{
					type: "text",
					text: "Let's continue with the task, from where we left off.",
				},
			]
		}
		if (userContent[0] && userContent[0].type === "text" && userContent[0].text?.trim() === "") {
			userContent[0].text = "Let's continue with the task, from where we left off."
		}
		this.currentUserContent = userContent

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
			if (userContent.length === 0) {
				userContent = [
					{
						type: "text",
						text: "Let's continue with the task, from where we left off.",
					},
				]
			}
			if (userContent[0] && userContent[0].type === "text" && userContent[0].text?.trim() === "") {
				userContent[0].text = "Let's continue with the task, from where we left off."
			}
			this.currentUserContent = userContent
			this.isRequestCancelled = false
			this.consecutiveErrorCount = 0
			this.abortController = new AbortController()
			await this.makeClaudeRequest()
		} else {
			this.logError(new Error("Cannot resume task: not in WAITING_FOR_USER state") as TaskError)
		}
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
		const now = Date.now()
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
		// find the last api request
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
				if (parsedTool.approvalState !== "error") {
					return true
				}
				return false
			})

		if (lastToolRequest) {
			const parsedTool = JSON.parse(lastToolRequest.text ?? "{}") as ChatTool
			if (parsedTool.approvalState === "approved") {
				return
			}
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
		if (lastApiRequest && isV1ClaudeMessage(lastApiRequest) && !lastApiRequest.isDone) {
			await this.stateManager.updateClaudeMessage(lastApiRequest.ts, {
				...lastApiRequest,
				isDone: true,
				isFetching: false,
				errorText: "Request cancelled by user",
				isError: true,
			})
		}
		// Update the provider state
		const now2 = Date.now()
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
		this.logState(`Provider state updated in ${Date.now() - now2}ms`)
		console.log(`Request cancelled in ${Date.now() - now}ms`)
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
			// make sure to reset the tool state before making a new request
			await this.toolExecutor.resetToolState()
			// make sure to reset claude abort state and abort controller
			this.isRequestCancelled = false
			this.abortController = new AbortController()

			if (this.consecutiveErrorCount >= 3) {
				await this.ask("resume_task", {
					question: "Claude has encountered an error 3 times in a row. Would you like to resume the task?",
				})
			}

			this.logState("Making Claude API request")

			await this.stateManager.addToApiConversationHistory({ role: "user", content: this.currentUserContent })
			const startedReqId = await this.say(
				"api_req_started",
				JSON.stringify({
					request: this.stateManager.apiManager.createUserReadableRequest(this.currentUserContent),
				})
			)

			// will the stream api request be called here?
			const stream = this.stateManager.apiManager.createApiStreamRequest(
				this.stateManager.state.apiConversationHistory,
				this.abortController?.signal
			)

			if (this.isRequestCancelled || this.isAborting) {
				this.abortController?.abort()
				this.logState("Request cancelled, ignoring response")
				return
			}

			this.stateManager.state.requestCount++
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
						text: ``,
					},
				],
			}
			await this.stateManager.addToApiConversationHistory(apiHistoryItem)
			let textBuffer = ""
			const updateInterval = 10 // milliseconds

			const debouncedUpdate = debounce(async (text: string) => {
				if (this.isRequestCancelled || this.isAborting) {
					console.log("Request was cancelled, not updating UI")
					return
				}
				textBuffer = ""
				await this.stateManager.appendToClaudeMessage(currentReplyId, text)
				await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
			}, updateInterval)

			const processor = new ChunkProcessor({
				onImmediateEndOfStream: async (chunk) => {
					if (this.isRequestCancelled || this.isAborting) {
						this.logState("Request was cancelled during onImmediateEndOfStream")
						return
					}
					if (chunk.code === 1) {
						console.log("End of stream reached")
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
						const updatedMsg: ClaudeMessage = {
							...this.stateManager.getMessageById(startedReqId)!,
							isDone: true,
							isFetching: false,
							errorText: chunk.body.msg ?? "Internal Server Error",
							isError: true,
						}
						await this.stateManager.updateClaudeMessage(startedReqId, updatedMsg)
						await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
						throw new KoduError({ code: chunk.body.status ?? 500 })
					}
				},
				onChunk: async (chunk) => {
					if (this.isRequestCancelled || this.isAborting) {
						this.logState("Request was cancelled during onChunk")
						return
					}
					if (chunk.code === 2) {
						if (this.isRequestCancelled || this.isAborting) {
							this.logState("Request was cancelled during debounced update")
							return
						}
						if (Array.isArray(apiHistoryItem.content) && apiHistoryItem.content[0].type === "text") {
							apiHistoryItem.content[0].text += chunk.body.text
							this.stateManager.updateApiHistoryItem(startedReqId, apiHistoryItem)
						}
						const nonXMLText = await this.toolExecutor.processToolUse(chunk.body.text)
						textBuffer += nonXMLText
						debouncedUpdate(textBuffer)
					}
				},
				onFinalEndOfStream: async () => {},
			})

			await processor.processStream(stream)
			if (this.isRequestCancelled || this.isAborting) {
				this.logState("Request was cancelled during onFinalEndOfStream")
				return
			}
			// Wait for all tool executions to complete
			await this.toolExecutor.waitForToolProcessing()

			await this.finishProcessingResponse(apiHistoryItem)
		} catch (error) {
			if (this.isRequestCancelled || this.isAborting) {
				// dont show message if request was cancelled
				throw error
			}
			// update the say to error
			// this.sayAfter("error", startedReqId, "An error occurred. Please try again.")
			throw error
		}
	}

	private async resetState() {
		this.abortController?.abort()
		this.isRequestCancelled = false
		this.abortController = null
		this.consecutiveErrorCount = 0
		this.state = TaskState.WAITING_FOR_USER
		await this.providerRef.deref()?.getWebviewManager()?.postStateToWebview()

		this.logState("State reset due to request cancellation")
	}

	private async finishProcessingResponse(assistantResponses: ApiHistoryItem): Promise<void> {
		this.logState("Finishing response processing")
		if (this.isRequestCancelled || this.isAborting) {
			return
		}

		if (assistantResponses.content.length === 0) {
			await this.say("error", "Unexpected Error: No assistant messages were found in the API response")
			await this.stateManager.updateApiHistoryItem(assistantResponses.ts!, {
				role: "assistant",
				content: [{ type: "text", text: "Failure: I did not have a response to provide." }],
			})
		}
		if (isTextBlock(assistantResponses.content[0]) && assistantResponses.content[0].text.trim() === "") {
			assistantResponses.content[0].text = "Failed to generate a response, please try again."
			this.stateManager.updateApiHistoryItem(assistantResponses.ts!, assistantResponses)
		}

		const currentToolResults = await this.toolExecutor.getToolResults()

		if (currentToolResults.length > 0) {
			console.log("[TaskExecutor] Tool results:", currentToolResults)
			const completionAttempted = currentToolResults.find((result) => {
				return result?.name === "attempt_completion"
			})
			console.log("[TaskExecutor] Completion attempted:", completionAttempted)

			if (completionAttempted) {
				await this.stateManager.addToApiConversationHistory({
					role: "user",
					content: completionAttempted.result,
				})
				await this.stateManager.addToApiConversationHistory({
					role: "assistant",
					content: [
						{
							type: "text",
							text: "I am pleased you are satisfied with the result. Do you have a new task for me?",
						},
					],
				})
				if (this.currentUserContent) {
					this.consecutiveErrorCount = 0
					this.state = TaskState.WAITING_FOR_API
					await this.makeClaudeRequest()
				}
			} else {
				this.state = TaskState.WAITING_FOR_API
				this.currentUserContent = currentToolResults.flatMap((result) => {
					if (typeof result.result === "string") {
						const block: Anthropic.Messages.TextBlockParam = { type: "text", text: result.result }
						return block
					}
					return result.result
				})
				this.consecutiveErrorCount = 0
				await this.makeClaudeRequest()
			}
		} else {
			this.state = TaskState.WAITING_FOR_API
			this.currentUserContent = [
				{
					type: "text",
					text: `
					Hey it's seems like you forgot to call a tool, if you have completed the task, you must use the attempt_completion tool with the result.
					Alternatively, if you want to ask me a question you must use ask_followup_question tool, to ask me a question.
					Thanks, now please proceed with the task or ask me a question or use the attempt_completion tool.
					`,
				},
			]
		}
	}

	private async handleApiError(error: TaskError): Promise<void> {
		this.logError(error)
		console.log(`[TaskExecutor] Error (State: ${this.state}):`, error)
		await this.toolExecutor.resetToolState()
		// update the last assistant message to error
		const lastAssistantMessage = this.stateManager.state.apiConversationHistory.at(-1)
		if (lastAssistantMessage && lastAssistantMessage.role === "assistant" && lastAssistantMessage.ts) {
			if (typeof lastAssistantMessage.content === "string") {
				lastAssistantMessage.content = [{ type: "text", text: lastAssistantMessage.content }]
			}
			if (Array.isArray(lastAssistantMessage.content) && isTextBlock(lastAssistantMessage.content[0])) {
				if (lastAssistantMessage.content[0].text.trim() === "") {
					lastAssistantMessage.content[0].text =
						"An error occurred in the generation of the response, i couldn't provide a response. please try again."
				} else {
					lastAssistantMessage.content.push({
						type: "text",
						text: "An error occurred in the middle of the response generation.",
					})
				}
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

export type AskResponse = {
	response: ClaudeAskResponse
	text?: string
	images?: string[]
}
