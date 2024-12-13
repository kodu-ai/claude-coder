import Anthropic from "@anthropic-ai/sdk"
import fs from "fs/promises"
import path from "path"
import { ExtensionProvider } from "../../providers/claude-coder/claude-coder-provider"
import { combineApiRequests } from "../../shared/combine-api-requests"
import { combineCommandSequences } from "../../shared/combine-command-sequences"
import { getApiMetrics } from "../../shared/get-api-metrics"
import { findLastIndex } from "../../utils"
import { ApiManager } from "../../api/api-handler"
import { DEFAULT_MAX_REQUESTS_PER_TASK } from "./constants"
import { ApiHistoryItem, ClaudeMessage, FileVersion, KoduDevOptions, KoduDevState } from "./types"
import { createWriteStream } from "fs"
// import { amplitudeTracker } from "@/utils/amplitude"
import { amplitudeTracker } from "../../utils/amplitude"

// Helper function to safely encode file paths to directory names
// For example, we can base64 encode. Alternatively, replace '/' with '__' or something similar.
function encodeFilePath(filePath: string): string {
	// Simple encoding: replace path separators with a triple underscore
	const replaced = filePath.replace(/[/\\]/g, "___")
	return Buffer.from(replaced).toString("base64") // encode to base64 for uniqueness
}

function decodeFilePath(encoded: string): string {
	const decoded = Buffer.from(encoded, "base64").toString("utf-8")
	return decoded.replace(/___/g, path.sep)
}

export class StateManager {
	private _state: KoduDevState
	private _apiManager: ApiManager
	private _providerRef: WeakRef<ExtensionProvider>
	private _alwaysAllowReadOnly: boolean
	private _customInstructions?: string
	private _alwaysAllowWriteOnly: boolean
	private _terminalCompressionThreshold?: number
	private _autoCloseTerminal?: boolean
	private _skipWriteAnimation?: boolean
	private _autoSummarize?: boolean
	private _temporayPauseAutomaticMode: boolean = false
	private _inlineEditOutputType?: "full" | "diff" = "full"
	private _gitHandlerEnabled: boolean = true

	constructor(options: KoduDevOptions) {
		const {
			provider,
			apiConfiguration,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			historyItem,
			autoCloseTerminal,
			skipWriteAnimation,
			autoSummarize,
			terminalCompressionThreshold,
			gitHandlerEnabled,
		} = options
		this._autoSummarize = autoSummarize
		this._providerRef = new WeakRef(provider)
		this._apiManager = new ApiManager(provider, apiConfiguration, customInstructions)
		this._alwaysAllowReadOnly = alwaysAllowReadOnly ?? false
		this._alwaysAllowWriteOnly = alwaysAllowWriteOnly ?? false
		this._customInstructions = customInstructions
		this._terminalCompressionThreshold = terminalCompressionThreshold
		this._gitHandlerEnabled = gitHandlerEnabled ?? true
		if (["full", "diff"].includes(options.inlineEditOutputType ?? "")) {
			this._inlineEditOutputType = options.inlineEditOutputType
		} else {
			this._inlineEditOutputType = "full"
			// update the global state
			provider.getGlobalStateManager().updateGlobalState("inlineEditOutputType", "full")
		}
		this._autoCloseTerminal = autoCloseTerminal
		this._skipWriteAnimation = skipWriteAnimation
		this._state = {
			taskId: historyItem ? historyItem.id : Date.now().toString(),
			dirAbsolutePath: historyItem?.dirAbsolutePath ?? "",
			isRepoInitialized: historyItem?.isRepoInitialized ?? false,
			requestCount: 0,
			memory: historyItem?.memory,
			apiConversationHistory: [],
			claudeMessages: [],
			abort: false,
		}
	}

	public popLastClaudeMessage(): ClaudeMessage | undefined {
		return this.state.claudeMessages.pop()
	}

	public popLastApiConversationMessage(): Anthropic.MessageParam | undefined {
		return this.state.apiConversationHistory.pop()
	}

	// Getter methods for read-only access
	get state(): KoduDevState {
		return this._state
	}

	get autoCloseTerminal(): boolean | undefined {
		return this._autoCloseTerminal
	}

	get customInstructions(): string | undefined {
		return this._customInstructions
	}

	get taskId(): string {
		return this.taskId
	}

	get temporayPauseAutomaticMode(): boolean {
		return this._temporayPauseAutomaticMode
	}

	get dirAbsolutePath(): string | undefined {
		return this.state.dirAbsolutePath
	}

	get isRepoInitialized(): boolean {
		return this.state.isRepoInitialized ?? false
	}

	get apiManager(): ApiManager {
		return this._apiManager
	}

	get terminalCompressionThreshold(): number | undefined {
		return this._terminalCompressionThreshold
	}
	set terminalCompressionThreshold(newValue: number | undefined) {
		this._terminalCompressionThreshold = newValue
	}

	get autoSummarize(): boolean | undefined {
		return this._autoSummarize
	}

	get providerRef(): WeakRef<ExtensionProvider> {
		return this._providerRef
	}

	get alwaysAllowReadOnly(): boolean {
		return this._alwaysAllowReadOnly
	}

	get alwaysAllowWriteOnly(): boolean {
		return this._alwaysAllowWriteOnly
	}

	get inlineEditOutputType(): "full" | "diff" | undefined {
		return this._inlineEditOutputType
	}

	get skipWriteAnimation(): boolean | undefined {
		return this._skipWriteAnimation
	}

	get gitHandlerEnabled(): boolean {
		return this._gitHandlerEnabled
	}

	// Methods to modify the properties
	public setState(newState: KoduDevState): void {
		this._state = newState
	}

	public setSkipWriteAnimation(newValue: boolean | undefined) {
		this._skipWriteAnimation = newValue
	}

	public setGitHandlerEnabled(newValue: boolean): void {
		this._gitHandlerEnabled = newValue
		this.state.gitHandlerEnabled = newValue
	}

	get historyErrors(): KoduDevState["historyErrors"] | undefined {
		return this.state.historyErrors
	}

	set historyErrors(newErrors: KoduDevState["historyErrors"]) {
		this.state.historyErrors = newErrors
	}

	public setHistoryErrorsEntry(key: string, value: NonNullable<KoduDevState["historyErrors"]>[string]): void {
		if (!this.state.historyErrors) {
			this.state.historyErrors = {}
		}
		this.state.historyErrors[key] = value
	}

	public getMessageById(messageId: number): ClaudeMessage | undefined {
		return this.state.claudeMessages.find((msg) => msg?.ts === messageId)
	}

	public setAutoCloseTerminal(newValue: boolean): void {
		this._autoCloseTerminal = newValue
	}

	public setTerminalCompressionThreshold(newValue?: number): void {
		this._terminalCompressionThreshold = newValue
	}

	public setApiManager(newApiManager: ApiManager): void {
		this._apiManager = newApiManager
	}

	public setProviderRef(newProviderRef: WeakRef<ExtensionProvider>): void {
		this._providerRef = newProviderRef
	}

	public setCustomInstructions(newInstructions?: string): void {
		this._customInstructions = newInstructions
	}

	public setAlwaysAllowReadOnly(newValue: boolean): void {
		this._alwaysAllowReadOnly = newValue
		this.updateAmplitudeSettings()
	}

	public setInlineEditOutputType(newValue?: "full" | "diff"): void {
		this._inlineEditOutputType = newValue
	}

	private updateAmplitudeSettings() {
		amplitudeTracker.updateUserSettings({
			AlwaysAllowReads: this.alwaysAllowReadOnly,
			AutomaticMode: this.alwaysAllowWriteOnly,
			AutoSummarize: this.autoSummarize,
		})
	}

	public setAlwaysAllowWriteOnly(newValue: boolean): void {
		this._alwaysAllowWriteOnly = newValue
		this.updateAmplitudeSettings()
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

	private async getFileVersionsDir(): Promise<string> {
		const taskDir = await this.ensureTaskDirectoryExists()
		const versionsDir = path.join(taskDir, "file_versions")
		await fs.mkdir(versionsDir, { recursive: true })
		return versionsDir
	}

	/**
	 * Save a new file version. Each file has its own directory under file_versions.
	 * We store each version in `version_<number>.json`.
	 * The file format: { "content": "file content", "createdAt": number }
	 */
	public async saveFileVersion(file: FileVersion): Promise<void> {
		const versionsDir = await this.getFileVersionsDir()
		const encodedPath = encodeFilePath(file.path)
		const fileDir = path.join(versionsDir, encodedPath)
		await fs.mkdir(fileDir, { recursive: true })

		const versionFilePath = path.join(fileDir, `version_${file.version}.json`)
		const data = {
			content: file.content,
			createdAt: file.createdAt,
		}
		await fs.writeFile(versionFilePath, JSON.stringify(data, null, 2))
	}

	/**
	 * Get all versions of a file by enumerating all `version_*.json` files in its directory.
	 */
	public async getFileVersions(relPath: string): Promise<FileVersion[]> {
		const versionsDir = await this.getFileVersionsDir()
		const encodedPath = encodeFilePath(relPath)
		const fileDir = path.join(versionsDir, encodedPath)

		try {
			const entries = await fs.readdir(fileDir)
			const versionFiles = entries.filter((e) => e.startsWith("version_") && e.endsWith(".json"))
			const versions: FileVersion[] = []
			for (const vf of versionFiles) {
				const versionMatch = vf.match(/version_(\d+)\.json$/)
				if (!versionMatch) continue
				const verNum = parseInt(versionMatch[1], 10)
				const fullPath = path.join(fileDir, vf)
				const contentStr = await fs.readFile(fullPath, "utf8")
				const json = JSON.parse(contentStr)
				versions.push({
					path: relPath,
					version: verNum,
					createdAt: json.createdAt,
					content: json.content,
				})
			}
			versions.sort((a, b) => a.version - b.version)
			return versions
		} catch (err) {
			// If directory doesn't exist or no versions found
			return []
		}
	}

	/**
	 * List all files and their versions in the task directory.
	 */
	public async getFilesInTaskDirectory(): Promise<Record<string, FileVersion[]>> {
		const versionsDir = await this.getFileVersionsDir()
		const result: Record<string, FileVersion[]> = {}
		try {
			const fileDirs = await fs.readdir(versionsDir)
			for (const fd of fileDirs) {
				const fileDir = path.join(versionsDir, fd)
				const stat = await fs.lstat(fileDir)
				if (stat.isDirectory()) {
					const relPath = decodeFilePath(fd)
					const versions = await this.getFileVersions(relPath)
					result[relPath] = versions
				}
			}
		} catch (err) {
			// no files
		}
		return result
	}

	async getSavedApiConversationHistory(): Promise<ApiHistoryItem[]> {
		// no need to read from file if we already have the history in memory
		if (this.state.apiConversationHistory.length > 0) {
			return this.state.apiConversationHistory
		}
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "api_conversation_history.json")
			const fileExists = await fs
				.access(filePath)
				.then(() => true)
				.catch(() => false)
			if (fileExists) {
				return JSON.parse(await fs.readFile(filePath, "utf8"))
			}
			return []
		} catch (err) {
			console.error("Failed to get saved API conversation history:", err)
			return []
		}
	}

	async getCleanedClaudeMessages(): Promise<ClaudeMessage[]> {
		const claudeMessages = await this.getSavedClaudeMessages()
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
		const apiHistory = await this.getSavedApiConversationHistory()
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
		if (!this.state.historyErrors) {
			this.state.historyErrors = {}
		}
		this.state.historyErrors[errorPath] = {
			lastCheckedAt: -1,
			error: "",
		}
	}

	async updateApiHistoryItem(messageId: number, message: ApiHistoryItem) {
		const index = this.state.apiConversationHistory.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(`[StateManager] updateApiConversationHistory: Message with id ${messageId} not found`)
			return
		}
		this.state.apiConversationHistory[index] = {
			...this.state.apiConversationHistory[index],
			...message,
		}
		await this.saveApiConversationHistory()
	}

	async addToApiConversationHistory(message: ApiHistoryItem) {
		if (message?.ts === undefined) {
			message.ts = Date.now()
		}
		this.state.apiConversationHistory.push(message)
		await this.saveApiConversationHistory()
		return message?.ts!
	}

	async overwriteApiConversationHistory(newHistory: ApiHistoryItem[]) {
		this.state.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}

	async setAutoSummarize(newValue: boolean): Promise<void> {
		this._autoSummarize = newValue
		this.updateAmplitudeSettings()
	}

	async saveApiConversationHistory() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "api_conversation_history.json")

			// Use writeStream for better performance with large files
			const writeStream = createWriteStream(filePath, {
				flags: "w",
				encoding: "utf8",
				mode: 0o666,
			})

			writeStream.write(JSON.stringify(this.state.apiConversationHistory, null, 2))
			await new Promise((resolve, reject) => {
				writeStream.end((err: Error) => {
					if (err) {
						reject(err)
					} else {
						resolve(null)
					}
				})
			})
		} catch (error) {
			console.error("Failed to save API conversation history:", error)
			throw error // Or handle according to your error strategy
		}
	}

	async getSavedClaudeMessages(): Promise<ClaudeMessage[]> {
		if (this.state.claudeMessages.length > 0) {
			return this.state.claudeMessages
		}
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

	private async saveClaudeMessages() {
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
		await this.providerRef
			.deref()
			?.getStateManager()
			.updateTaskHistory({
				id: this.state.taskId,
				ts: lastRelevantMessage?.ts,
				task: taskMessage.text ?? "",
				tokensIn: apiMetrics.totalTokensIn,
				tokensOut: apiMetrics.totalTokensOut,
				cacheWrites: apiMetrics.totalCacheWrites,
				cacheReads: apiMetrics.totalCacheReads,
				totalCost: apiMetrics.totalCost,
			})

		return this.state.claudeMessages
	}

	async removeEverythingAfterMessage(messageId: number) {
		const index = this.state.claudeMessages.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(`[StateManager] removeEverythingAfterMessage: Message with id ${messageId} not found`)
			return
		}
		console.log(
			`[StateManager] removeEverythingAfterMessage: Removing everything after message with id ${messageId}`
		)
		this.state.claudeMessages = this.state.claudeMessages.slice(0, index + 1)
		await this.saveClaudeMessages()
		return this.state.claudeMessages
	}

	async updateClaudeMessage(messageId: number, message: ClaudeMessage) {
		const index = this.state.claudeMessages.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(`[StateManager] updateClaudeMessage: Message with id ${messageId} not found`)
			return
		}
		this.state.claudeMessages[index] = message
		await this.saveClaudeMessages()
		return this.state.claudeMessages[index]
	}

	async appendToClaudeMessage(messageId: number, text: string) {
		const lastMessage = this.state.claudeMessages.find((msg) => msg?.ts === messageId)
		if (lastMessage && lastMessage.type === "say") {
			lastMessage.text += text
			await this.saveClaudeMessages()
			return lastMessage
		}
		return undefined
	}

	async addToClaudeAfterMessage(messageId: number, message: ClaudeMessage) {
		const index = this.state.claudeMessages.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(`[StateManager] addToClaudeAfterMessage: Message with id ${messageId} not found`)
			return
		}
		this.state.claudeMessages.splice(index + 1, 0, message)
		await this.saveClaudeMessages()
		return message
	}

	/**
	 *
	 * @param why Why Kodu choose is intrested in this file
	 * @param path the absolute path of the file
	 */
	async addinterestedFileToTask(why: string, path: string) {
		if (!this.state.interestedFiles) {
			this.state.interestedFiles = []
		}
		this.state.interestedFiles.push({ path, why, createdAt: Date.now() })
		await this.providerRef.deref()?.getStateManager().updateTaskHistory({
			id: this.state.taskId,
			interestedFiles: this.state.interestedFiles,
		})
	}

	async addToClaudeMessages(message: ClaudeMessage) {
		this.state.claudeMessages.push(message)
		await this.saveClaudeMessages()
		return message
	}

	async overwriteClaudeMessages(newMessages: ClaudeMessage[]) {
		this.state.claudeMessages = newMessages
		await this.saveClaudeMessages()
		return newMessages
	}

	public async setTemporaryPauseAutomaticMode(newValue: boolean): Promise<void> {
		this._temporayPauseAutomaticMode = newValue
	}
}
