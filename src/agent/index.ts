import { Anthropic } from "@anthropic-ai/sdk"
import * as fs from "fs/promises"
import * as path from "path"
import pWaitFor from "p-wait-for"
import { ClaudeDevProvider } from "../providers/ClaudeDevProvider"
import { ClaudeRequestResult } from "../shared/ClaudeRequestResult"
import { DEFAULT_MAX_REQUESTS_PER_TASK } from "../shared/Constants"
import { ClaudeAsk, ClaudeMessage, ClaudeSay } from "../shared/ExtensionMessage"
import { ToolName } from "../shared/Tool"
import { ClaudeAskResponse } from "../shared/WebviewMessage"
import { getApiMetrics } from "../shared/getApiMetrics"
import { HistoryItem } from "../shared/HistoryItem"
import { combineApiRequests } from "../shared/combineApiRequests"
import { combineCommandSequences, COMMAND_STDIN_STRING } from "../shared/combineCommandSequences"
import { findLastIndex } from "../utils"
import { ApiManager } from "./api-handler"
import { ToolExecutor } from "./tool-executor"
import { KoduDevOptions, KoduDevState, ToolResponse, UserContent } from "./types"
import { cwd, formatImagesIntoBlocks, getPotentiallyRelevantDetails } from "./utils"
import { ApiConfiguration } from "../api"
import { KoduError } from "../shared/kodu"
export class KoduDev {
	private state: KoduDevState
	private apiManager: ApiManager
	private toolExecutor: ToolExecutor
	private maxRequestsPerTask: number
	private providerRef: WeakRef<ClaudeDevProvider>
	private alwaysAllowReadOnly: boolean
	private creativeMode: "creative" | "normal" | "deterministic"
	private alwaysAllowWriteOnly: boolean
	private isRetryRequest: boolean = false

	constructor(options: KoduDevOptions) {
		const {
			provider,
			apiConfiguration,
			maxRequestsPerTask,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			task,
			images,
			historyItem,
			creativeMode,
		} = options
		this.creativeMode = creativeMode ?? "normal"
		this.providerRef = new WeakRef(provider)
		this.apiManager = new ApiManager(provider, apiConfiguration, customInstructions)
		this.alwaysAllowReadOnly = alwaysAllowReadOnly ?? false
		this.alwaysAllowWriteOnly = alwaysAllowWriteOnly ?? false
		this.toolExecutor = new ToolExecutor({
			cwd,
			alwaysAllowReadOnly: this.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: this.alwaysAllowWriteOnly,
			koduDev: this,
		})
		this.maxRequestsPerTask = maxRequestsPerTask ?? DEFAULT_MAX_REQUESTS_PER_TASK

		this.state = {
			taskId: historyItem ? historyItem.id : Date.now().toString(),
			requestCount: 0,
			apiConversationHistory: [],
			claudeMessages: [],
			abort: false,
		}

		if (historyItem) {
			this.resumeTaskFromHistory()
		} else if (task || images) {
			this.startTask(task, images)
		} else {
			throw new Error("Either historyItem or task/images must be provided")
		}
	}

	setCreativeMode(creativeMode: "creative" | "normal" | "deterministic") {
		this.creativeMode = creativeMode
	}

	updateAlwaysAllowApproveOnly(alwaysAllowWriteOnly: boolean | undefined) {
		this.alwaysAllowWriteOnly = alwaysAllowWriteOnly ?? false
		this.toolExecutor.setAlwaysAllowWriteOnly(this.alwaysAllowWriteOnly)
	}

	updateApi(apiConfiguration: ApiConfiguration) {
		this.apiManager.updateApi(apiConfiguration)
	}

	updateMaxRequestsPerTask(maxRequestsPerTask: number | undefined) {
		this.maxRequestsPerTask = maxRequestsPerTask ?? DEFAULT_MAX_REQUESTS_PER_TASK
	}

	updateCustomInstructions(customInstructions: string | undefined) {
		this.apiManager.updateCustomInstructions(customInstructions)
	}

	updateAlwaysAllowReadOnly(alwaysAllowReadOnly: boolean | undefined) {
		this.alwaysAllowReadOnly = alwaysAllowReadOnly ?? false
		this.toolExecutor.setAlwaysAllowReadOnly(this.alwaysAllowReadOnly)
	}

	public getState(): KoduDevState {
		return this.state
	}

	private async ensureTaskDirectoryExists(): Promise<string> {
		const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}
		const taskDir = path.join(globalStoragePath, "tasks", this.state.taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
	}

	private async getSavedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), "api_conversation_history.json")
		const fileExists = await fs
			.access(filePath)
			.then(() => true)
			.catch(() => false)
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}
		return []
	}

	private async addToApiConversationHistory(message: Anthropic.MessageParam) {
		this.state.apiConversationHistory.push(message)
		await this.saveApiConversationHistory()
	}

	private async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		this.state.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}

	private async saveApiConversationHistory() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "api_conversation_history.json")
			await fs.writeFile(filePath, JSON.stringify(this.state.apiConversationHistory))
		} catch (error) {
			console.error("Failed to save API conversation history:", error)
		}
	}

	private async getSavedClaudeMessages(): Promise<ClaudeMessage[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
		const fileExists = await fs
			.access(filePath)
			.then(() => true)
			.catch(() => false)
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}
		return []
	}

	private async addToClaudeMessages(message: ClaudeMessage) {
		this.state.claudeMessages.push(message)
		await this.saveClaudeMessages()
	}

	private async overwriteClaudeMessages(newMessages: ClaudeMessage[]) {
		this.state.claudeMessages = newMessages
		await this.saveClaudeMessages()
	}

	private async saveClaudeMessages() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
			await fs.writeFile(filePath, JSON.stringify(this.state.claudeMessages))
			const apiMetrics = getApiMetrics(
				combineApiRequests(combineCommandSequences(this.state.claudeMessages.slice(1)))
			)
			const taskMessage = this.state.claudeMessages[0]
			const lastRelevantMessage =
				this.state.claudeMessages[
					findLastIndex(
						this.state.claudeMessages,
						(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")
					)
				]
			await this.providerRef.deref()?.updateTaskHistory({
				id: this.state.taskId,
				ts: lastRelevantMessage.ts,
				task: taskMessage.text ?? "",
				tokensIn: apiMetrics.totalTokensIn,
				tokensOut: apiMetrics.totalTokensOut,
				cacheWrites: apiMetrics.totalCacheWrites,
				cacheReads: apiMetrics.totalCacheReads,
				totalCost: apiMetrics.totalCost,
			})
		} catch (error) {
			console.error("Failed to save claude messages:", error)
		}
	}

	private async startTask(task?: string, images?: string[]): Promise<void> {
		this.state.claudeMessages = []
		this.state.apiConversationHistory = []
		await this.providerRef.deref()?.postStateToWebview()

		let textBlock: Anthropic.TextBlockParam = {
			type: "text",
			text: `<task>\n${task}\n</task>\n\n${getPotentiallyRelevantDetails()}`,
		}
		let imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
		await this.say("text", task, images)
		await this.initiateTaskLoop([textBlock, ...imageBlocks])
	}

	async resumeTaskFromHistory() {
		const modifiedClaudeMessages = await this.getSavedClaudeMessages()

		const lastApiReqStartedIndex = modifiedClaudeMessages.reduce(
			(lastIndex, m, index) => (m.type === "say" && m.say === "api_req_started" ? index : lastIndex),
			-1
		)
		const lastApiReqFinishedIndex = modifiedClaudeMessages.reduce(
			(lastIndex, m, index) => (m.type === "say" && m.say === "api_req_finished" ? index : lastIndex),
			-1
		)
		if (lastApiReqStartedIndex > lastApiReqFinishedIndex && lastApiReqStartedIndex !== -1) {
			modifiedClaudeMessages.splice(lastApiReqStartedIndex, 1)
		}

		const lastRelevantMessageIndex = findLastIndex(
			modifiedClaudeMessages,
			(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")
		)
		if (lastRelevantMessageIndex !== -1) {
			modifiedClaudeMessages.splice(lastRelevantMessageIndex + 1)
		}

		await this.overwriteClaudeMessages(modifiedClaudeMessages)
		this.state.claudeMessages = await this.getSavedClaudeMessages()

		const lastClaudeMessage = this.state.claudeMessages
			.slice()
			.reverse()
			.find((m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"))

		let askType: ClaudeAsk =
			lastClaudeMessage?.ask === "completion_result" ? "resume_completed_task" : "resume_task"

		const { response, text, images } = await this.ask(askType)

		let newUserContent: UserContent = []
		if (response === "messageResponse") {
			await this.say("user_feedback", text, images)
			if (images && images.length > 0) {
				newUserContent.push(...formatImagesIntoBlocks(images))
			}
			if (text) {
				newUserContent.push({ type: "text", text })
			}
		}

		const existingApiConversationHistory: Anthropic.Messages.MessageParam[] =
			await this.getSavedApiConversationHistory()

		let modifiedOldUserContent: UserContent
		let modifiedApiConversationHistory: Anthropic.Messages.MessageParam[]
		if (existingApiConversationHistory.length > 0) {
			const lastMessage = existingApiConversationHistory[existingApiConversationHistory.length - 1]

			if (lastMessage.role === "assistant") {
				const content = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				const hasToolUse = content.some((block) => block.type === "tool_use")

				if (hasToolUse) {
					const toolUseBlocks = content.filter(
						(block) => block.type === "tool_use"
					) as Anthropic.Messages.ToolUseBlock[]
					const toolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => ({
						type: "tool_result",
						tool_use_id: block.id,
						content: "Task was interrupted before this tool call could be completed.",
					}))
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = [...toolResponses]
				} else {
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = []
				}
			} else if (lastMessage.role === "user") {
				const previousAssistantMessage =
					existingApiConversationHistory[existingApiConversationHistory.length - 2]

				const existingUserContent: UserContent = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				if (previousAssistantMessage && previousAssistantMessage.role === "assistant") {
					const assistantContent = Array.isArray(previousAssistantMessage.content)
						? previousAssistantMessage.content
						: [{ type: "text", text: previousAssistantMessage.content }]

					const toolUseBlocks = assistantContent.filter(
						(block) => block.type === "tool_use"
					) as Anthropic.Messages.ToolUseBlock[]

					if (toolUseBlocks.length > 0) {
						const existingToolResults = existingUserContent.filter(
							(block) => block.type === "tool_result"
						) as Anthropic.ToolResultBlockParam[]

						const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
							.filter(
								(toolUse) => !existingToolResults.some((result) => result.tool_use_id === toolUse.id)
							)
							.map((toolUse) => ({
								type: "tool_result",
								tool_use_id: toolUse.id,
								content: "Task was interrupted before this tool call could be completed.",
							}))

						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent, ...missingToolResponses]
					} else {
						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent]
					}
				} else {
					modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
					modifiedOldUserContent = [...existingUserContent]
				}
			} else {
				throw new Error("Unexpected: Last message is not a user or assistant message")
			}
		} else {
			throw new Error("Unexpected: No existing API conversation history")
		}

		const modifiedOldUserContentText = modifiedOldUserContent.find((block) => block.type === "text")?.text
		const newUserContentText = newUserContent.find((block) => block.type === "text")?.text
		const agoText = (() => {
			const timestamp = lastClaudeMessage?.ts ?? Date.now()
			const now = Date.now()
			const diff = now - timestamp
			const minutes = Math.floor(diff / 60000)
			const hours = Math.floor(minutes / 60)
			const days = Math.floor(hours / 24)

			if (days > 0) {
				return `${days} day${days > 1 ? "s" : ""} ago`
			}
			if (hours > 0) {
				return `${hours} hour${hours > 1 ? "s" : ""} ago`
			}
			if (minutes > 0) {
				return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
			}
			return "just now"
		})()

		const combinedText =
			`Task resumption: This autonomous coding task was interrupted ${agoText}. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. The current working directory is now ${cwd}. If the task has not been completed, retry the last step before interruption and proceed with completing the task.` +
			(modifiedOldUserContentText
				? `\n\nLast recorded user input before interruption:\n<previous_message>\n${modifiedOldUserContentText}\n</previous_message>\n`
				: "") +
			(newUserContentText
				? `\n\nNew instructions for task continuation:\n<user_message>\n${newUserContentText}\n</user_message>\n`
				: "") +
			`\n\n${getPotentiallyRelevantDetails()}`

		const newUserContentImages = newUserContent.filter((block) => block.type === "image")
		const combinedModifiedOldUserContentWithNewUserContent: UserContent = (
			modifiedOldUserContent.filter((block) => block.type !== "text") as UserContent
		).concat([{ type: "text", text: combinedText }, ...newUserContentImages])

		await this.overwriteApiConversationHistory(modifiedApiConversationHistory)
		await this.initiateTaskLoop(combinedModifiedOldUserContentWithNewUserContent)
	}

	async abortTask() {
		this.state.abort = true
		// this.abortingContinueTask = false
		this.toolExecutor.abortTask()
	}

	async ask(
		type: ClaudeAsk,
		question?: string
	): Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }> {
		if (this.state.abort) {
			throw new Error("ClaudeDev instance aborted")
		}
		this.state.askResponse = undefined
		this.state.askResponseText = undefined
		this.state.askResponseImages = undefined
		const askTs = Date.now()
		this.state.lastMessageTs = askTs
		await this.addToClaudeMessages({ ts: askTs, type: "ask", ask: type, text: question })
		console.log(`TS: ${askTs}\nWe asked: ${type}\nQuestion:: ${question}`)
		await this.providerRef.deref()?.postStateToWebview()
		await pWaitFor(() => this.state.askResponse !== undefined || this.state.lastMessageTs !== askTs, {
			interval: 100,
		})
		if (this.state.lastMessageTs !== askTs) {
			throw new Error("Current ask promise was ignored")
		}
		const result = {
			response: this.state.askResponse!,
			text: this.state.askResponseText,
			images: this.state.askResponseImages,
		}
		this.state.askResponse = undefined
		this.state.askResponseText = undefined
		this.state.askResponseImages = undefined
		return result
	}

	async say(type: ClaudeSay, text?: string, images?: string[]): Promise<void> {
		if (this.state.abort) {
			throw new Error("ClaudeDev instance aborted")
		}
		const sayTs = Date.now()
		this.state.lastMessageTs = sayTs
		await this.addToClaudeMessages({ ts: sayTs, type: "say", say: type, text: text, images })
		await this.providerRef.deref()?.postStateToWebview()
	}

	async handleWebviewAskResponse(askResponse: ClaudeAskResponse, text?: string, images?: string[]) {
		// if it's aborted, restart the task
		this.state.askResponse = askResponse
		this.state.askResponseText = text
		this.state.askResponseImages = images
	}
	private async initiateTaskLoop(userContent: UserContent): Promise<void> {
		let nextUserContent = userContent
		console.log("Initiating task loop")
		while (!this.state.abort) {
			const { didEndLoop } = await this.recursivelyMakeClaudeRequests(nextUserContent)

			if (didEndLoop) {
				console.log("Task loop ended")
				break
			} else {
				nextUserContent = [
					{
						type: "text",
						text: "If you have completed the user's task, use the attempt_completion tool. If you require additional information from the user, use the ask_followup_question tool. Otherwise, if you have not completed the task and do not need additional information, then proceed with the next step of the task. (This is an automated message, so do not respond to it conversationally.)",
					},
				]
			}
		}
	}

	async executeTool(toolName: ToolName, toolInput: any, isLastWriteToFile: boolean = false): Promise<ToolResponse> {
		return this.toolExecutor.executeTool(
			toolName,
			toolInput,
			isLastWriteToFile,
			this.ask.bind(this),
			this.say.bind(this)
		)
	}

	async recursivelyMakeClaudeRequests(userContent: UserContent): Promise<ClaudeRequestResult> {
		if (this.state.abort) {
			throw new Error("ClaudeDev instance aborted")
		}
		console.log(`Making Claude request with user content: ${JSON.stringify(userContent)}`)

		if (this.state.requestCount >= this.maxRequestsPerTask) {
			const { response } = await this.ask(
				"request_limit_reached",
				`Claude Dev has reached the maximum number of requests for this task. Would you like to reset the count and allow him to proceed?`
			)

			if (response === "yesButtonTapped") {
				this.state.requestCount = 0
			} else {
				await this.addToApiConversationHistory({
					role: "assistant",
					content: [
						{
							type: "text",
							text: "Failure: I have reached the request limit for this task. Do you have a new task for me?",
						},
					],
				})
				return { didEndLoop: true, inputTokens: 0, outputTokens: 0 }
			}
		}
		if (!this.isRetryRequest) {
			await this.addToApiConversationHistory({ role: "user", content: userContent })
			await this.say(
				"api_req_started",
				JSON.stringify({
					request: this.apiManager.createUserReadableRequest(userContent),
				})
			)
		}

		try {
			console.log(`conversation history: ${JSON.stringify(this.state.apiConversationHistory)}`)
			const response = await this.apiManager.createApiRequest(this.state.apiConversationHistory)
			this.state.requestCount++

			if (this.state.abort) {
				throw new Error("ClaudeDev instance aborted")
			}

			let assistantResponses: Anthropic.Messages.ContentBlock[] = []
			let inputTokens = response.usage.input_tokens
			let outputTokens = response.usage.output_tokens
			let cacheCreationInputTokens =
				(response as Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage).usage
					.cache_creation_input_tokens || undefined
			let cacheReadInputTokens =
				(response as Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage).usage
					.cache_read_input_tokens || undefined
			await this.say(
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

			for (const contentBlock of response.content) {
				if (contentBlock.type === "text") {
					assistantResponses.push(contentBlock)
					await this.say("text", contentBlock.text)
				}
			}

			let toolResults: Anthropic.ToolResultBlockParam[] = []
			let attemptCompletionBlock: Anthropic.Messages.ToolUseBlock | undefined
			const writeToFileCount = response.content.filter(
				(block) => block.type === "tool_use" && (block.name as ToolName) === "write_to_file"
			).length
			let currentWriteToFile = 0
			for (const contentBlock of response.content) {
				if (contentBlock.type === "tool_use") {
					assistantResponses.push(contentBlock)
					const toolName = contentBlock.name as ToolName
					const toolInput = contentBlock.input
					const toolUseId = contentBlock.id
					if (toolName === "attempt_completion") {
						attemptCompletionBlock = contentBlock
					} else {
						if (toolName === "write_to_file") {
							currentWriteToFile++
						}
						const result = await this.executeTool(
							toolName,
							toolInput,
							currentWriteToFile === writeToFileCount
						)
						toolResults.push({ type: "tool_result", tool_use_id: toolUseId, content: result })
					}
				}
			}

			if (assistantResponses.length > 0) {
				await this.addToApiConversationHistory({ role: "assistant", content: assistantResponses })
			} else {
				await this.say("error", "Unexpected Error: No assistant messages were found in the API response")
				await this.addToApiConversationHistory({
					role: "assistant",
					content: [{ type: "text", text: "Failure: I did not have a response to provide." }],
				})
			}

			let didEndLoop = false

			if (attemptCompletionBlock) {
				let result = await this.executeTool(
					attemptCompletionBlock.name as ToolName,
					attemptCompletionBlock.input
				)
				if (result === "") {
					didEndLoop = true
					result = "The user is satisfied with the result."
				}
				toolResults.push({ type: "tool_result", tool_use_id: attemptCompletionBlock.id, content: result })
			}

			if (toolResults.length > 0) {
				if (didEndLoop) {
					await this.addToApiConversationHistory({ role: "user", content: toolResults })
					await this.addToApiConversationHistory({
						role: "assistant",
						content: [
							{
								type: "text",
								text: "I am pleased you are satisfied with the result. Do you have a new task for me?",
							},
						],
					})
				} else {
					const {
						didEndLoop: recDidEndLoop,
						inputTokens: recInputTokens,
						outputTokens: recOutputTokens,
					} = await this.recursivelyMakeClaudeRequests(toolResults)
					didEndLoop = recDidEndLoop
					inputTokens += recInputTokens
					outputTokens += recOutputTokens
				}
			}

			return { didEndLoop, inputTokens, outputTokens }
		} catch (error) {
			this.isRetryRequest = false
			console.error("API request failed", error)
			if (error instanceof KoduError) {
				const { response, text } = await this.ask("api_req_failed", error.message)
				if (response === "yesButtonTapped" || response === "messageResponse") {
					await this.say("api_req_retried")
					this.isRetryRequest = true
					return { didEndLoop: false, inputTokens: 0, outputTokens: 0 }
				}

				return { didEndLoop: true, inputTokens: 0, outputTokens: 0 }
			}
			return { didEndLoop: true, inputTokens: 0, outputTokens: 0 }
		}
	}
}

export * from "./types"
