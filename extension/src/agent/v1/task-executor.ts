import * as path from "path"
import { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeAsk, ClaudeMessage, ClaudeSay, isV1ClaudeMessage } from "../../shared/ExtensionMessage"
import { ClaudeAskResponse } from "../../shared/WebviewMessage"
import { combineApiRequests } from "../../shared/combineApiRequests"
import { getApiMetrics } from "../../shared/getApiMetrics"
import { KoduError, koduSSEResponse } from "../../shared/kodu"
import { amplitudeTracker } from "../../utils/amplitude"
import { StateManager } from "./state-manager"
import { ToolExecutor } from "./tool-executor"
import ToolParser from "./tools/tool-parser/tool-parser"
import { ToolInput } from "./tools/types"
import { ToolName, ToolResponse, UserContent } from "./types"
import { debounce } from "lodash"
import { ChunkProcessor } from "./chunk-proccess"
import { ExtensionProvider } from "../../providers/claude-coder/ClaudeCoderProvider"
import { GitHandler } from "./handlers/git-handler"
import { tools } from "./tools/schema"
import { nanoid } from "nanoid"
import { BaseAgentTool } from "./tools/base-agent.tool"
import { WriteFileTool } from "./tools"
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

export class ToolItem {
	public toolName: string
	public input: ToolInput
	public id: string
	public isDone: boolean
	constructor(toolName: string, input: ToolInput, id: string) {
		this.toolName = toolName
		this.input = input
		this.id = id
		this.isDone = false
	}
}

export class TaskExecutor {
	public state: TaskState = TaskState.IDLE
	public gitHandler: GitHandler
	private stateManager: StateManager
	private toolExecutor: ToolExecutor
	private providerRef: WeakRef<ExtensionProvider>
	private currentUserContent: UserContent | null = null
	private currentApiResponse: Anthropic.Messages.Message | null = null
	private currentToolResults: { name: string; result: ToolResponse }[] = []
	private pendingAskResponse: ((value: AskResponse) => void) | null = null
	private isRequestCancelled: boolean = false
	private abortController: AbortController | null = null
	private consecutiveErrorCount: number = 0
	private toolQueue: BaseAgentTool[] = []
	private isProcessingTool: boolean = false
	private toolInstances: { [id: string]: BaseAgentTool } = {}
	private toolExecutionPromises: Promise<void>[] = []
	private toolProcessingComplete: Promise<void> | null = null
	private resolveToolProcessing: (() => void) | null = null

	constructor(stateManager: StateManager, toolExecutor: ToolExecutor, providerRef: WeakRef<ExtensionProvider>) {
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
		this.cancelCurrentRequest()
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

		if (this.stateManager.state.claudeMessages.length === 2) {
			return // Can't cancel the first message
		}
		this.logState("Cancelling current request")

		this.isRequestCancelled = true
		this.abortController?.abort()
		this.state = TaskState.ABORTED
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
		await this.ask("followup", "The current request has been cancelled. Would you like to ask a new question?")
		await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
	}

	public async makeClaudeRequest(): Promise<void> {
		try {
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

		try {
			this.logState("Processing API response")
			const assistantResponses: Anthropic.Messages.ContentBlock[] = []
			this.currentToolResults = []
			const currentReplyId = await this.say("text", "")
			let textBuffer = ""
			const updateInterval = 5 // milliseconds
			const toolExecutor = new ToolParser(
				tools.map((tool) => tool.schema),
				{
					onToolUpdate: async (id, toolName, params) => {
						let toolInstance = this.toolInstances[id]
						if (!toolInstance) {
							const newTool = this.toolExecutor.getTool({
								name: toolName as ToolName,
								input: params,
								id: id,
								isFinal: false,
								isLastWriteToFile: false,
								ask: this.ask.bind(this),
								say: this.say.bind(this),
							})
							this.toolInstances[id] = newTool
						} else {
							toolInstance.updateParams(params)
							toolInstance.updateIsFinal(false)
							const inToolQueue = this.toolQueue.find((tool) => tool.id === id)
							if (inToolQueue) {
								inToolQueue.updateParams(params)
							}
						}
						if (toolName === "write_to_file") {
							// if the queue is empty, then we can handle the partial content
							const isInQueue = this.toolQueue.find((tool) => tool.id === id)
							const isInQueueIndex = this.toolQueue.findIndex((tool) => tool.id === id)
							// if (this.toolQueue.length === 0) {
							// 	;(this.toolInstances[id] as WriteFileTool).handlePartialContent(
							// 		params.path,
							// 		params.content
							// 	)
							// 	this.toolQueue.push(this.toolInstances[id])
							// }
							// if (isInQueue && isInQueueIndex === 0) {
							// 	// this means that the tool is the only one in the queue
							// 	// so we can keep handling the partial content
							// 	;(this.toolInstances[id] as WriteFileTool).handlePartialContent(
							// 		params.path,
							// 		params.content
							// 	)
							// }
						}
					},
					onToolEnd: async (id, toolName, input) => {
						let toolInstance = this.toolInstances[id]
						if (!toolInstance) {
							const newTool = this.toolExecutor.getTool({
								name: toolName as ToolName,
								input: input,
								id: id,
								isFinal: true,
								isLastWriteToFile: false,
								ask: this.ask.bind(this),
								say: this.say.bind(this),
							})
							this.toolInstances[id] = newTool
						} else {
							toolInstance.updateParams(input)
							toolInstance.updateIsFinal(true)
						}
						this.addToolToQueue(toolInstance)
					},
				}
			)

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
						console.log(`End of stream reached`)
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
							errorText: chunk.body.msg ?? `Internal Server Error`,
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
								console.log(`Request was cancelled, ignoring response`)
								return
							}

							if (contentBlock.type === "text") {
								assistantResponses.push(contentBlock)
							} else if (contentBlock.type === "tool_use") {
								assistantResponses.push(contentBlock)
								const koduDev = this.providerRef.deref()?.getKoduDev()
								if (koduDev && "write_to_file" === contentBlock.name) {
									koduDev.isLastMessageFileEdit = true
								}
							}

							if (this.isRequestCancelled) {
								console.log(`Request was cancelled after processing a block`)
								return
							}
						}
					}
					if (chunk.code === 2) {
						if (this.isRequestCancelled) {
							this.logState("Request was cancelled during debounced update")
							return
						}
						textBuffer += chunk.body.text
						debouncedUpdate(textBuffer)
						toolExecutor.appendText(chunk.body.text)
					}
				},
				onFinalEndOfStream: async (chunk) => {},
			})

			await processor.processStream(stream)
			if (this.isRequestCancelled) {
				this.logState("Request was cancelled during onFinalEndOfStream")
				return
			}
			console.log(`All promises length: ${this.toolExecutionPromises.length}`)
			// Wait for all tool executions to complete
			await this.waitForToolProcessing()
			await this.finishProcessingResponse(assistantResponses, /*inputTokens*/ 0, /*outputTokens*/ 0)
		} finally {
		}
	}
	private addToolToQueue(toolInstance: BaseAgentTool): void {
		this.toolQueue.push(toolInstance)
		if (!this.isProcessingTool) {
			this.processNextTool()
		}
		if (!this.toolProcessingComplete) {
			this.toolProcessingComplete = new Promise((resolve) => {
				this.resolveToolProcessing = resolve
			})
		}
	}

	private async processNextTool(): Promise<void> {
		if (this.toolQueue.length === 0) {
			this.isProcessingTool = false
			if (this.resolveToolProcessing) {
				this.resolveToolProcessing()
				this.toolProcessingComplete = null
				this.resolveToolProcessing = null
			}
			return
		}

		this.isProcessingTool = true
		const toolInstance = this.toolQueue.shift()!

		try {
			if (this.isRequestCancelled) {
				this.logState("Request was cancelled during tool execution")
				return
			}
			this.state = TaskState.EXECUTING_TOOL
			if (toolInstance.name === "attempt_completion") {
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
			// Execute the tool
			const result = await toolInstance?.execute({
				name: toolInstance?.name as ToolName,
				input: toolInstance?.paramsInput!,
				id: toolInstance?.id!,
				isFinal: toolInstance?.isFinal!,
				isLastWriteToFile: false,
				ask: this.ask.bind(this),
				say: this.say.bind(this),
			})
			// Store the result
			this.currentToolResults.push({ name: toolInstance.name, result: result! })
			this.state = TaskState.PROCESSING_RESPONSE
		} catch (error) {
			console.error(`Error executing tool: ${toolInstance.name}`, error)
			await this.handleToolError(error as TaskError)
		} finally {
			// Process the next tool in the queue
			this.processNextTool()
		}
	}

	private async waitForToolProcessing(): Promise<void> {
		if (this.toolProcessingComplete) {
			await this.toolProcessingComplete
		}
	}

	private resetState(): void {
		this.state = TaskState.IDLE
		this.abortController?.abort()
		this.currentApiResponse = null
		this.currentToolResults = []
		this.isRequestCancelled = false
		this.abortController = null
		this.consecutiveErrorCount = 0
		this.isProcessingTool = false
		this.toolQueue = []
		this.toolExecutionPromises = []

		// Abort ongoing tools
		for (const toolId in this.toolInstances) {
			this.toolInstances[toolId]?.abortToolExecution()
			delete this.toolInstances[toolId]
		}

		this.logState("State reset due to request cancellation")
	}

	private async onBeforeToolExecution(toolName: ToolName, input: ToolInput): Promise<void> {
		const initTriggers = ["write_to_file", "update_file"]
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

				await this.providerRef.deref()?.getStateManager()?.updateTaskHistory(historyItem)
				await this.stateManager.setState(state)
			}
		}
	}

	private async onAfterToolExecution(toolName: ToolName, input: ToolInput): Promise<void> {
		if (toolName === "upsert_memory") {
			await this.gitHandler.commitChanges(input.milestoneName!, input.summary!)
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
		}
		if (this.currentToolResults.length > 0) {
			console.log(`[TaskExecutor] assistantResponses:`, assistantResponses)
			const completionAttempted = this.currentToolResults.find((result) => {
				return result.name === "attempt_completion"
			})
			console.log(`[TaskExecutor] Completion attempted:`, completionAttempted)

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
					this.state = TaskState.WAITING_FOR_USER
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

	private async handleApiError(error: TaskError): Promise<void> {
		this.logError(error)
		console.log(`[TaskExecutor] Error (State: ${this.state}):`, error)
		this.stateManager.popLastApiConversationMessage()
		this.consecutiveErrorCount++
		const { response } = await this.ask("api_req_failed", error.message)
		if (response === "yesButtonTapped" || response === "messageResponse") {
			console.log(JSON.stringify(this.stateManager.state.claudeMessages, null, 2))

			await this.say("api_req_retried")
			this.state = TaskState.WAITING_FOR_API
			await this.makeClaudeRequest()
		} else {
			this.state = TaskState.COMPLETED
		}
	}

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
