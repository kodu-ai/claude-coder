import path from "path"
import { ClaudeDevProvider } from "../../providers/ClaudeDevProvider"
import { ApiConfiguration } from "../../shared/api"
import { ApiManager } from "../api-handler"
import { DEFAULT_MAX_REQUESTS_PER_TASK } from "../constants"
import { ToolExecutor } from "../tool-executor"
import { ClaudeMessage, KoduDevOptions, KoduDevState } from "../types"
import fs from "fs/promises"
import Anthropic from "@anthropic-ai/sdk"
import { getApiMetrics } from "../../shared/getApiMetrics"
import { combineApiRequests } from "../../shared/combineApiRequests"
import { combineCommandSequences } from "../../shared/combineCommandSequences"
import { findLastIndex } from "../../utils"

// new State Manager class
export class StateManager {
	private _state: KoduDevState
	private _apiManager: ApiManager
	private _maxRequestsPerTask: number
	private _providerRef: WeakRef<ClaudeDevProvider>
	private _alwaysAllowReadOnly: boolean
	private _creativeMode: "creative" | "normal" | "deterministic"
	private _customInstructions?: string
	private _alwaysAllowWriteOnly: boolean

	constructor(options: KoduDevOptions) {
		const {
			provider,
			apiConfiguration,
			maxRequestsPerTask,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			historyItem,
			creativeMode,
		} = options
		this._creativeMode = creativeMode ?? "normal"
		this._providerRef = new WeakRef(provider)
		this._apiManager = new ApiManager(provider, apiConfiguration, customInstructions)
		this._alwaysAllowReadOnly = alwaysAllowReadOnly ?? false
		this._alwaysAllowWriteOnly = alwaysAllowWriteOnly ?? false
		this._customInstructions = customInstructions
		this._maxRequestsPerTask = maxRequestsPerTask ?? DEFAULT_MAX_REQUESTS_PER_TASK

		this._state = {
			taskId: historyItem ? historyItem.id : Date.now().toString(),
			requestCount: 0,
			apiConversationHistory: [],
			claudeMessages: [],
			abort: false,
		}
	}

	public popLastClaudeMessage(): ClaudeMessage | undefined {
		return this.state.claudeMessages.pop()
	}

	// Getter methods for read-only access
	get state(): KoduDevState {
		return this._state
	}

	get customInstructions(): string | undefined {
		return this._customInstructions
	}

	get apiManager(): ApiManager {
		return this._apiManager
	}

	get maxRequestsPerTask(): number {
		return this._maxRequestsPerTask
	}

	get providerRef(): WeakRef<ClaudeDevProvider> {
		return this._providerRef
	}

	get alwaysAllowReadOnly(): boolean {
		return this._alwaysAllowReadOnly
	}

	get creativeMode(): "creative" | "normal" | "deterministic" {
		return this._creativeMode
	}

	get alwaysAllowWriteOnly(): boolean {
		return this._alwaysAllowWriteOnly
	}

	// Methods to modify the properties (only accessible within the class)
	public setState(newState: KoduDevState): void {
		this._state = newState
	}

	public setApiManager(newApiManager: ApiManager): void {
		this._apiManager = newApiManager
	}

	public setMaxRequestsPerTask(newMax?: number): void {
		this._maxRequestsPerTask = newMax ?? DEFAULT_MAX_REQUESTS_PER_TASK
	}

	public setProviderRef(newProviderRef: WeakRef<ClaudeDevProvider>): void {
		this._providerRef = newProviderRef
	}

	public setCustomInstructions(newInstructions?: string): void {
		this._customInstructions = newInstructions
	}

	public setAlwaysAllowReadOnly(newValue: boolean): void {
		this._alwaysAllowReadOnly = newValue
	}

	public setCreativeMode(newMode: "creative" | "normal" | "deterministic"): void {
		this._creativeMode = newMode
	}

	public setAlwaysAllowWriteOnly(newValue: boolean): void {
		this._alwaysAllowWriteOnly = newValue
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

	async addToApiConversationHistory(message: Anthropic.MessageParam) {
		this.state.apiConversationHistory.push(message)
		await this.saveApiConversationHistory()
	}

	async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		this.state.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}

	async saveApiConversationHistory() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "api_conversation_history.json")
			await fs.writeFile(filePath, JSON.stringify(this.state.apiConversationHistory))
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

	async addToClaudeMessages(message: ClaudeMessage) {
		this.state.claudeMessages.push(message)
		await this.saveClaudeMessages()
	}

	async overwriteClaudeMessages(newMessages: ClaudeMessage[]) {
		this.state.claudeMessages = newMessages
		await this.saveClaudeMessages()
	}

	async saveClaudeMessages() {
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
}
