import { findLastIndex } from "lodash"
import { ExtensionProvider } from "../../../providers/claude-coder/claude-coder-provider"
import { KoduDevState, ClaudeMessage } from "../types"
import { IOManager } from "./io-manager"
import { combineApiRequests } from "../../../shared/combine-api-requests"
import { combineCommandSequences } from "../../../shared/combine-command-sequences"
import { getApiMetrics } from "../../../shared/get-api-metrics"
import { isV1ClaudeMessage } from "../../../shared/extension-message"
import { StateManager } from "."

interface ClaudeMessagesManagerOptions {
	state: KoduDevState
	ioManager: IOManager
	providerRef: WeakRef<ExtensionProvider>
	stateManager: StateManager
}

export class ClaudeMessagesManager {
	private stateManager: StateManager
	private state: KoduDevState
	private ioManager: IOManager
	private providerRef: WeakRef<ExtensionProvider>

	constructor(options: ClaudeMessagesManagerOptions) {
		this.state = options.state
		this.ioManager = options.ioManager
		this.providerRef = options.providerRef
		this.stateManager = options.stateManager
	}

	public async getSavedClaudeMessages(): Promise<ClaudeMessage[]> {
		if (this.state.claudeMessages.length > 0) {
			return this.state.claudeMessages
		}
		const messages = await this.ioManager.loadClaudeMessages()
		this.state.claudeMessages.length = 0
		// Use in-place modification to update the existing array
		this.state.claudeMessages.push(...messages)
		return this.state.claudeMessages
	}

	public async saveClaudeMessages() {
		await this.ioManager.saveClaudeMessages(this.state.claudeMessages)

		// Update task metrics and history
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

	public getMessageById(messageId: number): ClaudeMessage | undefined {
		return this.state.claudeMessages.find((msg) => msg?.ts === messageId)
	}

	public async addToClaudeMessages(message: ClaudeMessage) {
		if (isV1ClaudeMessage(message)) {
			message.agentName = this.stateManager.subAgentManager.agentName
			message.modelId = this.stateManager.apiManager.getModelId()
		}
		this.state.claudeMessages.push(message)
		await this.saveClaudeMessages()
		return message
	}

	// Refactored to use in-place modifications
	public async overwriteClaudeMessages(newMessages: ClaudeMessage[]) {
		// We do it because the newMessages might be a reference to the same array
		const newMessagesCopy = [...newMessages]
		// Clear the existing array in-place
		this.state.claudeMessages.length = 0
		// Push the new messages into the now-empty array
		this.state.claudeMessages.push(...newMessagesCopy)
		await this.saveClaudeMessages()
		return this.state.claudeMessages
	}

	// Refactored to use in-place modification (.length)
	public async removeEverythingAfterMessage(messageId: number) {
		const index = this.state.claudeMessages.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(
				`[ClaudeMessagesManager] removeEverythingAfterMessage: Message with id ${messageId} not found`
			)
			return
		}
		// In-place modification using .length:
		this.state.claudeMessages.length = index + 1
		await this.saveClaudeMessages()
		return this.state.claudeMessages
	}

	public async updateClaudeMessage(messageId: number, message: ClaudeMessage) {
		const index = this.state.claudeMessages.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(`[ClaudeMessagesManager] updateClaudeMessage: Message with id ${messageId} not found`)
			return
		}
		// In-place update of the message object
		this.state.claudeMessages[index] = message
		await this.saveClaudeMessages()
		return this.state.claudeMessages[index]
	}

	public async appendToClaudeMessage(messageId: number, text: string, withFlush = false) {
		const lastMessage = this.state.claudeMessages.find((msg) => msg?.ts === messageId)
		if (lastMessage && lastMessage.type === "say") {
			lastMessage.text += text
			// Update webview if requested
			if (withFlush) {
				await this.providerRef.deref()?.getWebviewManager().postClaudeMessageToWebview(lastMessage)
			}
			await this.saveClaudeMessages()

			return lastMessage
		}
		return undefined
	}

	public async addToClaudeAfterMessage(messageId: number, message: ClaudeMessage) {
		const index = this.state.claudeMessages.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(`[ClaudeMessagesManager] addToClaudeAfterMessage: Message with id ${messageId} not found`)
			return
		}
		if (isV1ClaudeMessage(message)) {
			message.agentName = this.stateManager.subAgentManager.agentName
			message.modelId = this.stateManager.apiManager.getModelId()
		}
		// In-place insertion using splice
		this.state.claudeMessages.splice(index + 1, 0, message)
		await this.saveClaudeMessages()
		return message
	}

	// If you need to expose a "cleaned" version for display but don't want
	// to modify the original, create a copy here.
	public async getCleanedClaudeMessages(): Promise<ClaudeMessage[]> {
		const claudeMessages = await this.getSavedClaudeMessages()
		// Create a deep copy and redact the text in the copy
		return claudeMessages.map((message) => ({
			...message,
			text: "[REDACTED]",
		}))
	}
}
