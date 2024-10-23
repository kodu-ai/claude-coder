import Anthropic from "@anthropic-ai/sdk"
import fs from "fs/promises"
import path from "path"
import dotenv from "dotenv"
import { findLastIndex, combineApiRequests, combineCommandSequences, getApiMetrics } from "@/utils"
import { ClaudeMessage, KoduDevOptions, KoduDevState } from "@/types"

dotenv.config()

export const DEFAULT_MAX_REQUESTS_PER_TASK = 20

export class StateService {
	private static instance: StateService
	private _state: KoduDevState
	private _options: KoduDevOptions
	private _globalStoragePath: string

	private constructor() {
		this._state = {} as KoduDevState
		this._options = {} as KoduDevOptions
		this._globalStoragePath = process.env.GLOBAL_STORAGE_PATH || path.join(__dirname, "storage.json")
	}

	public static getInstance(): StateService {
		if (!StateService.instance) {
			StateService.instance = new StateService()
		}
		return StateService.instance
	}

	public async initialize(options: KoduDevOptions): Promise<void> {
		try {
			this._options = options
			this._state = {
				taskId: this._options.historyItem ? this._options.historyItem.id : Date.now().toString(),
				dirAbsolutePath: this._options.historyItem?.dirAbsolutePath ?? "",
				isRepoInitialized: this._options.historyItem?.isRepoInitialized ?? false,
				requestCount: 0,
				memory: this._options.historyItem?.memory,
				apiConversationHistory: [],
				claudeMessages: [],
				abort: false,
			}
		} catch (error) {
			console.error("Failed to initialize state:", error)
			throw error
		}
	}

	public popLastClaudeMessage(): ClaudeMessage | undefined {
		return this._state.claudeMessages.pop()
	}

	public popLastApiConversationMessage(): Anthropic.MessageParam | undefined {
		return this._state.apiConversationHistory.pop()
	}

	// Getter methods for read-only access
	get state(): KoduDevState {
		return this._state
	}

	get autoCloseTerminal(): boolean | undefined {
		return this._options.autoCloseTerminal
	}

	get customInstructions(): string | undefined {
		return this._options.customInstructions
	}

	get taskId(): string {
		return this._state.taskId
	}

	get dirAbsolutePath(): string | undefined {
		return this._state.dirAbsolutePath
	}

	get isRepoInitialized(): boolean {
		return this._state.isRepoInitialized ?? false
	}

	get experimentalTerminal(): boolean | undefined {
		return this._options.experimentalTerminal
	}

	get maxRequestsPerTask(): number {
		return this._options.maxRequestsPerTask ?? DEFAULT_MAX_REQUESTS_PER_TASK
	}

	get alwaysAllowReadOnly(): boolean {
		return this._options.alwaysAllowReadOnly ?? false
	}

	get creativeMode(): "creative" | "normal" | "deterministic" {
		return this._options.creativeMode ?? "normal"
	}

	get alwaysAllowWriteOnly(): boolean {
		return this._options.alwaysAllowWriteOnly ?? false
	}

	get skipWriteAnimation(): boolean | undefined {
		return this._options.skipWriteAnimation
	}

	// Methods to modify the properties (only accessible within the class)
	public setState(newState: KoduDevState): void {
		this._state = newState
	}

	public setSkipWriteAnimation(newValue: boolean | undefined) {
		this._options.skipWriteAnimation = newValue
	}

	get historyErrors(): KoduDevState["historyErrors"] | undefined {
		return this._state.historyErrors
	}

	set historyErrors(newErrors: KoduDevState["historyErrors"]) {
		this._state.historyErrors = newErrors
	}

	public setHistoryErrorsEntry(key: string, value: NonNullable<KoduDevState["historyErrors"]>[string]): void {
		if (!this._state.historyErrors) {
			this._state.historyErrors = {}
		}
		this._state.historyErrors[key] = value
	}

	public getMessageById(messageId: number): ClaudeMessage | undefined {
		return this.state.claudeMessages.find((msg) => msg.ts === messageId)
	}

	public setAutoCloseTerminal(newValue: boolean): void {
		this._options.autoCloseTerminal = newValue
	}

	public setExperimentalTerminal(newValue: boolean): void {
		this._options.experimentalTerminal = newValue
	}

	public setMaxRequestsPerTask(newMax?: number): void {
		this._options.maxRequestsPerTask = newMax ?? DEFAULT_MAX_REQUESTS_PER_TASK
	}

	public setCustomInstructions(newInstructions?: string): void {
		this._options.customInstructions = newInstructions
	}

	public setAlwaysAllowReadOnly(newValue: boolean): void {
		this._options.alwaysAllowReadOnly = newValue
	}

	public setCreativeMode(newMode: "creative" | "normal" | "deterministic"): void {
		this._options.creativeMode = newMode
	}

	public setAlwaysAllowWriteOnly(newValue: boolean): void {
		this._options.alwaysAllowWriteOnly = newValue
	}

	private async ensureTaskDirectoryExists(): Promise<string> {
		const taskDir = path.join(this._globalStoragePath, "tasks", this._state.taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
	}

	async getSavedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
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

	async getCleanedClaudeMessages(): Promise<ClaudeMessage[]> {
		const claudeMessages = await this.getSavedClaudeMessages()
		// remove any content text from tool_result or user message or assistant message

		const mappedClaudeMessages = claudeMessages.map((message) => {
			const sanitizedMessage: ClaudeMessage = {
				...message,
				text: "[REDACTED]",
			}

			return sanitizedMessage
		})

		return mappedClaudeMessages
	}
	async getCleanedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
		// apiHistory = Anthropic.Messages.MessageParam[]
		const apiHistory = await this.getSavedApiConversationHistory()
		// remove any content text from tool_result or user message or assistant message
		const sanitizeContent = (content: Anthropic.MessageParam["content"]): string | Array<any> => {
			if (typeof content === "string") {
				return "[REDACTED]"
			} else if (Array.isArray(content)) {
				return content.map((item) => {
					if (item.type === "tool_use") {
						return { ...item, content: "[REDACTED]", input: "[REDACTED]" }
					}
					if (item.type === "text") {
						return { ...item, text: "[REDACTED]" }
					} else if (item.type === "tool_result") {
						return { ...item, content: "[REDACTED]" }
					} else if (item.type === "image") {
						// Preserve image blocks without modification
						return item
					}
					return item
				})
			}
			return content
		}

		const mappedApiHistory = apiHistory.map((message) => {
			const sanitizedMessage: Anthropic.MessageParam = {
				...message,
				content: sanitizeContent(message.content),
			}

			return sanitizedMessage
		})

		return mappedApiHistory
	}

	public addErrorPath(errorPath: string): void {
		// push a new key to the historyErrors object
		if (!this._state.historyErrors) {
			this._state.historyErrors = {}
		}
		this._state.historyErrors[errorPath] = {
			lastCheckedAt: -1,
			error: "",
		}
	}

	async addToApiConversationHistory(message: Anthropic.MessageParam) {
		this._state.apiConversationHistory.push(message)
		this.saveApiConversationHistory()
	}

	async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		this._state.apiConversationHistory = newHistory
		this.saveApiConversationHistory()
	}

	async saveApiConversationHistory() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "api_conversation_history.json")
			await fs.writeFile(filePath, JSON.stringify(this._state.apiConversationHistory))
		} catch (error) {
			console.error("Failed to save API conversation history:", error)
		}
	}

	async getSavedClaudeMessages(): Promise<ClaudeMessage[]> {
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

	async removeEverythingAfterMessage(messageId: number) {
		const index = this._state.claudeMessages.findIndex((msg) => msg.ts === messageId)
		if (index === -1) {
			console.error(`[StateManager] removeEverythingAfterMessage: Message with id ${messageId} not found`)
			return
		}
		console.log(`[StateManager] removeEverythingAfterMessage: Removing everything after message with id ${messageId}`)
		this._state.claudeMessages = this._state.claudeMessages.slice(0, index + 1)
		this.saveClaudeMessages()
	}

	async updateClaudeMessage(messageId: number, message: ClaudeMessage) {
		const index = this._state.claudeMessages.findIndex((msg) => msg.ts === messageId)
		if (index === -1) {
			console.error(`[StateManager] updateClaudeMessage: Message with id ${messageId} not found`)
			return
		}
		this._state.claudeMessages[index] = message
		await this.saveClaudeMessages()
	}

	async appendToClaudeMessage(messageId: number, text: string) {
		const lastMessage = this._state.claudeMessages.find((msg) => msg.ts === messageId)
		if (lastMessage && lastMessage.type === "say") {
			lastMessage.text += text
		}
		// too heavy to save every chunk we should save the whole message at the end
		await this.saveClaudeMessages()
	}

	async addToClaudeAfterMessage(messageId: number, message: ClaudeMessage) {
		const index = this._state.claudeMessages.findIndex((msg) => msg.ts === messageId)
		if (index === -1) {
			console.error(`[StateManager] addToClaudeAfterMessage: Message with id ${messageId} not found`)
			return
		}
		this._state.claudeMessages.splice(index + 1, 0, message)
		await this.saveClaudeMessages()
	}

	async addToClaudeMessages(message: ClaudeMessage) {
		this._state.claudeMessages.push(message)
		await this.saveClaudeMessages()
	}

	async overwriteClaudeMessages(newMessages: ClaudeMessage[]) {
		this._state.claudeMessages = newMessages
		await this.saveClaudeMessages()
	}

	/**
	 * rewrite required.
	 *
	 * @deprecated
	 */
	async saveClaudeMessages() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
			await fs.writeFile(filePath, JSON.stringify(this._state.claudeMessages))
			const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(this._state.claudeMessages.slice(1))))
			const taskMessage = this._state.claudeMessages[0]
			const lastRelevantMessage =
				this._state.claudeMessages[
					findLastIndex(
						this._state.claudeMessages,
						(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")
					)
				]

			// @TODO: refactor this to use the new state manager
			// await this.providerRef
			// 	.deref()
			// 	?.getStateManager()
			// 	.updateTaskHistory({
			// 		id: this.state.taskId,
			// 		ts: lastRelevantMessage.ts,
			// 		task: taskMessage.text ?? "",
			// 		tokensIn: apiMetrics.totalTokensIn,
			// 		tokensOut: apiMetrics.totalTokensOut,
			// 		cacheWrites: apiMetrics.totalCacheWrites,
			// 		cacheReads: apiMetrics.totalCacheReads,
			// 		totalCost: apiMetrics.totalCost,
			// 	})
		} catch (error) {
			console.error("Failed to save claude messages:", error)
		}
	}
}

export const stateService = StateService.getInstance()
