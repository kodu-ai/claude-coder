import { ClaudeAsk, ClaudeMessage } from "../../../shared/ExtensionMessage"
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

interface TaskContext {
	id: string
	state: TaskState
	abortController: AbortController
	userContent: UserContent | null
	currentReplyId?: number
	toolResults: { name: string; result: ToolResponse }[]
}

export class TaskExecutor extends TaskExecutorUtils {
	private currentTask: TaskContext | null = null
	private toolExecutor: ToolExecutor
	private streamPaused: boolean = false
	private textBuffer: string = ""
	private askManager: AskManager

	constructor(stateManager: StateManager, toolExecutor: ToolExecutor, providerRef: WeakRef<ExtensionProvider>) {
		super(stateManager, providerRef)
		this.toolExecutor = toolExecutor
		this.askManager = new AskManager(stateManager)
	}

	public get state(): TaskState {
		return this.getState()
	}

	protected getState(): TaskState {
		return this.currentTask?.state ?? TaskState.IDLE
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

	private async flushTextBuffer() {
		if (!this.currentTask?.currentReplyId || !this.textBuffer.trim()) {
			return
		}

		await this.stateManager.appendToClaudeMessage(this.currentTask.currentReplyId, this.textBuffer)
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
		this.textBuffer = ""
	}

	public async newMessage(message: UserContent) {
		await this.startTask(message)
	}

	public async startTask(userContent: UserContent): Promise<void> {
		if (this.currentTask) {
			await this.abortTask()
		}

		this.currentTask = {
			id: Date.now().toString(),
			state: TaskState.WAITING_FOR_API,
			abortController: new AbortController(),
			userContent: this.normalizeUserContent(userContent),
			toolResults: [],
		}

		try {
			await this.makeClaudeRequest()
		} catch (error) {
			await this.handleError(error)
		}
	}

	public async resumeTask(userContent: UserContent): Promise<void> {
		if (this.getState() !== TaskState.WAITING_FOR_USER) {
			throw new Error("Cannot resume task: not in WAITING_FOR_USER state")
		}

		this.currentTask = {
			id: Date.now().toString(),
			state: TaskState.WAITING_FOR_API,
			abortController: new AbortController(),
			userContent: this.normalizeUserContent(userContent),
			toolResults: [],
		}

		try {
			await this.makeClaudeRequest()
		} catch (error) {
			await this.handleError(error)
		}
	}

	private normalizeUserContent(content: UserContent): UserContent {
		if (content.length === 0 || (content[0]?.type === "text" && !content[0].text?.trim())) {
			return [{ type: "text", text: "Let's continue with the task." }]
		}
		return content
	}

	public async abortTask(): Promise<void> {
		if (!this.currentTask) {
			return
		}

		const task = this.currentTask
		this.currentTask = null

		try {
			task.abortController.abort()
			await this.toolExecutor.abortTask()
			await this.resetState()
		} catch (error) {
			console.error("Error during task abortion:", error)
		}
	}

	private async makeClaudeRequest(): Promise<void> {
		if (!this.currentTask?.userContent || this.currentTask.state !== TaskState.WAITING_FOR_API) {
			return
		}

		try {
			await this.toolExecutor.resetToolState()

			await this.stateManager.addToApiConversationHistory({
				role: "user",
				content: this.currentTask.userContent,
			})

			const startedReqId = await this.say(
				"api_req_started",
				JSON.stringify({
					request: this.stateManager.apiManager.createUserReadableRequest(this.currentTask.userContent),
				})
			)

			const stream = this.stateManager.apiManager.createApiStreamRequest(
				this.stateManager.state.apiConversationHistory,
				this.currentTask.abortController.signal
			)

			this.currentTask.state = TaskState.PROCESSING_RESPONSE
			await this.processApiResponse(stream, startedReqId)
		} catch (error) {
			if (this.currentTask) {
				await this.handleError(error)
			}
		}
	}

	private async processApiResponse(
		stream: AsyncGenerator<koduSSEResponse, any, unknown>,
		startedReqId: number
	): Promise<void> {
		if (!this.currentTask || this.currentTask.state !== TaskState.PROCESSING_RESPONSE) {
			return
		}

		try {
			const currentReplyId = await this.say("text", "")
			this.currentTask.currentReplyId = currentReplyId

			const apiHistoryItem: ApiHistoryItem = {
				role: "assistant",
				ts: startedReqId,
				content: [{ type: "text", text: "" }],
			}
			await this.stateManager.addToApiConversationHistory(apiHistoryItem)

			const processor = new ChunkProcessor({
				onImmediateEndOfStream: async (chunk) => {
					if (!this.currentTask) {
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
					}

					if (chunk.code === -1) {
						await this.stateManager.updateClaudeMessage(startedReqId, {
							...this.stateManager.getMessageById(startedReqId)!,
							isDone: true,
							isFetching: false,
							errorText: chunk.body.msg ?? "Internal Server Error",
							isError: true,
						})
						throw new KoduError({ code: chunk.body.status ?? 500 })
					}

					await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
				},

				onChunk: async (chunk) => {
					if (!this.currentTask) {
						return
					}

					if (chunk.code === 2) {
						if (Array.isArray(apiHistoryItem.content) && isTextBlock(apiHistoryItem.content[0])) {
							apiHistoryItem.content[0].text += chunk.body.text
							await this.stateManager.updateApiHistoryItem(startedReqId, apiHistoryItem)
							await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
						}

						if (!this.streamPaused) {
							const nonXMLText = await this.toolExecutor.processToolUse(chunk.body.text)
							if (nonXMLText) {
								this.textBuffer += nonXMLText
								await this.flushTextBuffer()
							}

							if (this.toolExecutor.hasActiveTools()) {
								this.pauseStream()
								await this.toolExecutor.waitForToolProcessing()
								this.resumeStream()
							}
						}
					}
				},

				onFinalEndOfStream: async () => {
					if (!this.currentTask) {
						return
					}

					await this.toolExecutor.waitForToolProcessing()
					await this.flushTextBuffer()
					await this.finishProcessingResponse(apiHistoryItem)
				},
			})

			await processor.processStream(stream)
		} catch (error) {
			if (this.currentTask) {
				await this.handleError(error)
			}
		}
	}

	private async resetState() {
		this.streamPaused = false
		this.textBuffer = ""
		this.currentTask = null
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
	}

	private async finishProcessingResponse(assistantResponses: ApiHistoryItem): Promise<void> {
		if (!this.currentTask) {
			return
		}

		const toolResults = await this.toolExecutor.getToolResults()
		this.currentTask.toolResults = toolResults

		if (toolResults.length === 0) {
			this.currentTask.state = TaskState.WAITING_FOR_API
			this.currentTask.userContent = [
				{
					type: "text",
					text: "You must use a tool to proceed. Either use attempt_completion if you've completed the task, or ask_followup_question if you need more information.",
				},
			]
			await this.makeClaudeRequest()
			return
		}

		const completionAttempt = toolResults.find((result) => result?.name === "attempt_completion")
		if (completionAttempt) {
			await this.handleCompletionAttempt(completionAttempt)
			return
		}

		this.currentTask.state = TaskState.WAITING_FOR_API
		this.currentTask.userContent = toolResults.flatMap((result) => {
			if (typeof result.result === "string") {
				return [{ type: "text", text: result.result }]
			}
			return result.result
		})

		await this.makeClaudeRequest()
	}

	private async handleCompletionAttempt(completionAttempted: { name: string; result: ToolResponse }) {
		await this.stateManager.addToApiConversationHistory({
			role: "user",
			content: completionAttempted.result,
		})

		if (this.currentTask?.userContent) {
			this.currentTask.state = TaskState.WAITING_FOR_API
			await this.makeClaudeRequest()
		}
	}

	private async handleError(error: unknown): Promise<void> {
		if (!this.currentTask) {
			return
		}

		const taskError =
			error instanceof TaskError
				? error
				: new TaskError({
						type: error instanceof KoduError ? "API_ERROR" : "UNKNOWN_ERROR",
						message: getErrorMessage(error),
				  })

		console.error("Task error:", taskError)
		await this.toolExecutor.resetToolState()

		const lastAssistantMessage = this.stateManager.state.apiConversationHistory.at(-1)
		if (lastAssistantMessage?.role === "assistant" && lastAssistantMessage.ts) {
			await this.updateErrorMessage(lastAssistantMessage)
		}

		if (error instanceof KoduError) {
			if (error.errorCode === KODU_ERROR_CODES.AUTHENTICATION_ERROR) {
				await this.handleAuthError("unauthorized")
				return
			}
			if (error.errorCode === KODU_ERROR_CODES.PAYMENT_REQUIRED) {
				await this.handleAuthError("payment_required")
				return
			}
		}

		const { response } = await this.ask("api_req_failed", {
			question: error instanceof Error ? error.message : "An unknown error occurred",
		})

		if (response === "yesButtonTapped" || response === "messageResponse") {
			await this.say("api_req_retried")
			this.currentTask.state = TaskState.WAITING_FOR_API
			await this.makeClaudeRequest()
		} else {
			this.currentTask.state = TaskState.COMPLETED
		}
	}

	private async updateErrorMessage(message: ApiHistoryItem) {
		if (typeof message.content === "string") {
			message.content = [{ type: "text", text: message.content }]
		}

		if (Array.isArray(message.content) && isTextBlock(message.content[0])) {
			message.content[0].text =
				message.content[0].text.trim() ||
				"An error occurred in the generation of the response. Please try again."
		}

		if (message.ts) {
			await this.stateManager.updateApiHistoryItem(message.ts, message)
		}
	}

	private async handleAuthError(type: "unauthorized" | "payment_required") {
		if (!this.currentTask) {
			return
		}

		this.currentTask.state = TaskState.IDLE
		await this.say(
			type,
			type === "unauthorized"
				? "Authentication failed. Please check your credentials."
				: "Payment required. Please check your subscription."
		)
	}
}
