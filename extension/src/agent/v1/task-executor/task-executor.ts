import { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeMessage, isV1ClaudeMessage } from "../../../shared/ExtensionMessage"
import { ClaudeAskResponse } from "../../../shared/WebviewMessage"
import { KoduError, koduSSEResponse } from "../../../shared/kodu"
import { StateManager } from "../state-manager"
import { ToolExecutor } from "../tools/tool-executor"
import { ChunkProcessor } from "../chunk-proccess"
import { ExtensionProvider } from "../../../providers/claude-coder/ClaudeCoderProvider"
import { ToolResponse, UserContent } from "../types"
import { debounce } from "lodash"
import { TaskError, TaskExecutorUtils, TaskState } from "./utils"

export class TaskExecutor extends TaskExecutorUtils {
	public state: TaskState = TaskState.IDLE
	public toolExecutor: ToolExecutor
	private currentUserContent: UserContent | null = null
	private currentApiResponse: Anthropic.Messages.Message | null = null
	private currentToolResults: { name: string; result: ToolResponse }[] = []
	private isRequestCancelled: boolean = false
	private abortController: AbortController | null = null
	private consecutiveErrorCount: number = 0

	constructor(stateManager: StateManager, toolExecutor: ToolExecutor, providerRef: WeakRef<ExtensionProvider>) {
		super(stateManager, providerRef)
		this.toolExecutor = toolExecutor
	}
	protected getState(): TaskState {
		return this.state
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
		this.logState("Aborting task")
		await this.cancelCurrentRequest()
		await this.resetState()
	}

	private async cancelCurrentRequest(): Promise<void> {
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
		if (lastApiRequest && isV1ClaudeMessage(lastApiRequest) && !lastApiRequest.isDone) {
			await this.stateManager.updateClaudeMessage(lastApiRequest.ts, {
				...lastApiRequest,
				isDone: true,
				isFetching: false,
				errorText: "Request cancelled by user",
				isError: true,
			})
			await this.stateManager.removeEverythingAfterMessage(lastApiRequest.ts)
		}
		// Update the provider state
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
	}

	public async makeClaudeRequest(): Promise<void> {
		try {
			if (this.state !== TaskState.WAITING_FOR_API || !this.currentUserContent || this.isRequestCancelled) {
				return
			}
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
				if (error instanceof KoduError) {
					console.log("[TaskExecutor] KoduError:", error)
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
		if (this.state !== TaskState.PROCESSING_RESPONSE || this.isRequestCancelled) {
			return
		}

		try {
			this.logState("Processing API response")
			const assistantResponses: Anthropic.Messages.ContentBlock[] = []
			this.currentToolResults = []
			const currentReplyId = await this.say("text", "")
			let textBuffer = ""
			const updateInterval = 10 // milliseconds

			const debouncedUpdate = debounce(async (text: string) => {
				if (this.isRequestCancelled) {
					console.log("Request was cancelled, not updating UI")
					return
				}
				textBuffer = ""
				await this.stateManager.appendToClaudeMessage(currentReplyId, text)
				await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
			}, updateInterval)

			const processor = new ChunkProcessor({
				onImmediateEndOfStream: async (chunk) => {
					if (this.isRequestCancelled) {
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
					if (this.isRequestCancelled) {
						this.logState("Request was cancelled during onChunk")
						return
					}
					if (chunk.code === 1) {
						const { inputTokens, outputTokens } = chunk.body.internal
						for (const contentBlock of chunk.body.anthropic.content) {
							if (this.isRequestCancelled) {
								console.log("Request was cancelled, ignoring response")
								return
							}

							if (contentBlock.type === "text") {
								assistantResponses.push(contentBlock)
							}

							if (this.isRequestCancelled) {
								console.log("Request was cancelled after processing a block")
								return
							}
						}
					}
					if (chunk.code === 2) {
						if (this.isRequestCancelled) {
							this.logState("Request was cancelled during debounced update")
							return
						}
						const nonXMLText = await this.toolExecutor.processToolUse(chunk.body.text)
						textBuffer += nonXMLText
						debouncedUpdate(textBuffer)
					}
				},
				onFinalEndOfStream: async () => {},
			})

			await processor.processStream(stream)
			if (this.isRequestCancelled) {
				this.logState("Request was cancelled during onFinalEndOfStream")
				return
			}
			// Wait for all tool executions to complete
			await this.toolExecutor.waitForToolProcessing()
			await this.finishProcessingResponse(assistantResponses, /*inputTokens*/ 0, /*outputTokens*/ 0)
		} finally {
		}
	}

	private async resetState() {
		this.abortController?.abort()
		this.currentApiResponse = null
		this.currentToolResults = []
		this.isRequestCancelled = false
		this.abortController = null
		this.consecutiveErrorCount = 0
		this.state = TaskState.WAITING_FOR_USER
		await this.toolExecutor.resetToolState()

		this.logState("State reset due to request cancellation")
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
			console.log("[TaskExecutor] assistantResponses:", assistantResponses)
			await this.stateManager.addToApiConversationHistory({ role: "assistant", content: assistantResponses })
		} else {
			await this.say("error", "Unexpected Error: No assistant messages were found in the API response")
			await this.stateManager.addToApiConversationHistory({
				role: "assistant",
				content: [{ type: "text", text: "Failure: I did not have a response to provide." }],
			})
		}

		this.currentToolResults = await this.toolExecutor.getToolResults()
		if (this.currentToolResults.length > 0) {
			console.log("[TaskExecutor] Tool results:", this.currentToolResults)
			const completionAttempted = this.currentToolResults.find((result) => {
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
				this.currentUserContent = this.currentToolResults.flatMap((result) => {
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

	private async handleRequestLimitReached(): Promise<void> {
		this.logState("Request limit reached")
		const { response } = await this.ask("request_limit_reached", {
			question:
				"Claude Coder has reached the maximum number of requests for this task. Would you like to reset the count and allow him to proceed?",
		})
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
		await this.toolExecutor.resetToolState()
		this.stateManager.popLastApiConversationMessage()
		this.consecutiveErrorCount++
		const { response } = await this.ask("api_req_failed", { question: error.message })
		if (response === "yesButtonTapped" || response === "messageResponse") {
			console.log(JSON.stringify(this.stateManager.state.claudeMessages, null, 2))

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
