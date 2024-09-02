import { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeAsk, ClaudeSay } from "../../shared/ExtensionMessage"
import { ClaudeAskResponse } from "../../shared/WebviewMessage"
import { ToolName } from "../../shared/Tool"
import { ApiManager } from "../api-handler"
import { ToolExecutor } from "./tool-executor"
import { UserContent, ToolResponse } from "../types"
import { StateManager } from "./state-manager"

type TaskState = "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "ABORTED"
type Message = {
	type: "ask" | "say"
	content: {
		type: ClaudeAsk | ClaudeSay
		text?: string
		images?: string[]
	}
}

type AskResponse = {
	response: ClaudeAskResponse
	text?: string
	images?: string[]
}

export class TaskExecutor {
	private state: TaskState = "IDLE"
	private stateManager: StateManager
	private apiManager: ApiManager
	private toolExecutor: ToolExecutor
	private messageQueue: Message[] = []
	private askResponseQueue: AskResponse[] = []
	private messageHandler: ((message: Message) => void) | null = null
	private askResponseHandler: ((response: AskResponse) => void) | null = null

	constructor(stateManager: StateManager, apiManager: ApiManager, toolExecutor: ToolExecutor) {
		this.stateManager = stateManager
		this.apiManager = apiManager
		this.toolExecutor = toolExecutor
	}

	async startTask(userContent: UserContent): Promise<void> {
		this.state = "RUNNING"
		await this.executeTask(userContent)
	}

	async resumeTask(userContent: UserContent): Promise<void> {
		if (this.state === "PAUSED") {
			this.state = "RUNNING"
			await this.executeTask(userContent)
		}
	}

	pauseTask(): void {
		if (this.state === "RUNNING") {
			this.state = "PAUSED"
		}
	}

	abortTask(): void {
		this.state = "ABORTED"
	}

	private async executeTask(userContent: UserContent): Promise<void> {
		while (this.state === "RUNNING") {
			const result = await this.makeClaudeRequest(userContent)

			if (result.didEndLoop) {
				this.state = "COMPLETED"
				break
			}

			userContent = [
				{
					type: "text",
					text: "If you have completed the user's task, use the attempt_completion tool. If you require additional information from the user, use the ask_followup_question tool. Otherwise, if you have not completed the task and do not need additional information, then proceed with the next step of the task. (This is an automated message, so do not respond to it conversationally.)",
				},
			]
		}
	}

	private async makeClaudeRequest(
		userContent: UserContent
	): Promise<{ didEndLoop: boolean; inputTokens: number; outputTokens: number }> {
		if (this.state !== "RUNNING") {
			return { didEndLoop: true, inputTokens: 0, outputTokens: 0 }
		}

		if (this.stateManager.state.requestCount >= this.stateManager.maxRequestsPerTask) {
			const shouldContinue = await this.handleRequestLimitReached()
			if (!shouldContinue) {
				return { didEndLoop: true, inputTokens: 0, outputTokens: 0 }
			}
		}

		await this.stateManager.addToApiConversationHistory({ role: "user", content: userContent })
		await this.say(
			"api_req_started",
			JSON.stringify({ request: this.apiManager.createUserReadableRequest(userContent) })
		)

		try {
			const response = await this.apiManager.createApiRequest(this.stateManager.state.apiConversationHistory)
			this.stateManager.state.requestCount++

			const { inputTokens, outputTokens } = this.processApiResponse(response)
			const toolResults = await this.executeTools(response.content)

			if (toolResults.some((result) => result.type === "tool_result" && result.content === "")) {
				return { didEndLoop: true, inputTokens, outputTokens }
			}

			if (toolResults.length > 0) {
				return await this.makeClaudeRequest(toolResults)
			}

			return { didEndLoop: false, inputTokens, outputTokens }
		} catch (error) {
			return this.handleApiError(error)
		}
	}

	private async handleRequestLimitReached(): Promise<boolean> {
		const { response } = await this.ask(
			"request_limit_reached",
			`Claude Dev has reached the maximum number of requests for this task. Would you like to reset the count and allow him to proceed?`
		)

		if (response === "yesButtonTapped") {
			this.stateManager.state.requestCount = 0
			return true
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
			return false
		}
	}

	private processApiResponse(response: Anthropic.Messages.Message): { inputTokens: number; outputTokens: number } {
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

	private async executeTools(content: Anthropic.Messages.ContentBlock[]): Promise<Anthropic.ToolResultBlockParam[]> {
		const toolResults: Anthropic.ToolResultBlockParam[] = []
		const writeToFileCount = content.filter(
			(block) => block.type === "tool_use" && (block.name as ToolName) === "write_to_file"
		).length
		let currentWriteToFile = 0

		for (const block of content) {
			if (block.type === "text") {
				await this.say("text", block.text)
			} else if (block.type === "tool_use") {
				const toolName = block.name as ToolName
				const toolInput = block.input
				const toolUseId = block.id

				if (toolName === "write_to_file") {
					currentWriteToFile++
				}

				const result = await this.toolExecutor.executeTool(
					toolName,
					toolInput,
					currentWriteToFile === writeToFileCount,
					this.ask.bind(this),
					this.say.bind(this)
				)

				toolResults.push({ type: "tool_result", tool_use_id: toolUseId, content: result })
			}
		}

		return toolResults
	}

	private async handleApiError(
		error: any
	): Promise<{ didEndLoop: boolean; inputTokens: number; outputTokens: number }> {
		console.error("API request failed", error)
		if (error instanceof Error) {
			const { response } = await this.ask("api_req_failed", error.message)
			if (response === "yesButtonTapped" || response === "messageResponse") {
				await this.say("api_req_retried")
				return { didEndLoop: false, inputTokens: 0, outputTokens: 0 }
			}
		}
		return { didEndLoop: true, inputTokens: 0, outputTokens: 0 }
	}

	public ask(
		type: ClaudeAsk,
		question?: string
	): Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }> {
		return new Promise((resolve) => {
			const message: Message = {
				type: "ask",
				content: { type, text: question },
			}
			this.messageQueue.push(message)

			if (this.messageHandler) {
				this.messageHandler(message)
			}

			this.askResponseHandler = (response) => {
				resolve(response)
				this.askResponseHandler = null
			}
		})
	}

	public say(type: ClaudeSay, text?: string, images?: string[]): Promise<void> {
		return new Promise((resolve) => {
			const message: Message = {
				type: "say",
				content: { type, text, images },
			}
			this.messageQueue.push(message)

			if (this.messageHandler) {
				this.messageHandler(message)
			}

			resolve()
		})
	}

	public setMessageHandler(handler: (message: Message) => void): void {
		this.messageHandler = handler
	}

	public handleAskResponse(response: AskResponse): void {
		this.askResponseQueue.push(response)

		if (this.askResponseHandler) {
			this.askResponseHandler(response)
		}
	}

	public getNextMessage(): Message | null {
		return this.messageQueue.shift() || null
	}

	public clearQueues(): void {
		this.messageQueue = []
		this.askResponseQueue = []
	}
}
