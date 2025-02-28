import { findLastIndex } from "lodash"
import { ExtensionProvider } from "../../../providers/extension-provider"
import { KoduAgentState, ClaudeMessage } from "../types"
import { IOManager } from "./io-manager"
import { getApiMetrics } from "../../../shared/get-api-metrics"
import { isV1ClaudeMessage } from "../../../shared/messages/extension-message"
import { StateManager } from "."
import { ChatTool } from "../../../shared/new-tools"

interface ClaudeMessagesManagerOptions {
	state: KoduAgentState
	ioManager: IOManager
	providerRef: WeakRef<ExtensionProvider>
	stateManager: StateManager
}

export type OverwriteClaudeMessagesOptions = {
	// Update the task history timestamp
	updateTs?: boolean
	updateIsDone?: boolean
}

export class ClaudeMessagesManager {
	private stateManager: StateManager
	private state: KoduAgentState
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

	public async saveClaudeMessages(updateTs = true, updateIsDone = true): Promise<ClaudeMessage[]> {
		await this.ioManager.saveClaudeMessages(this.state.claudeMessages)
		// Update task metrics and history
		const apiMetrics = getApiMetrics(this.state.claudeMessages)
		const taskMessage = this.state.claudeMessages[0]
		const lastRelevantMessage =
			this.state.claudeMessages[
				findLastIndex(
					this.state.claudeMessages,
					(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")
				)
			]
		let isTaskCompleted = false
		try {
			let lastMessage = this.state.claudeMessages[this.state.claudeMessages.length - 1]
			// If last message is resume_task or resume_completed_task, get the previous message
			if (lastMessage.ask === "resume_task" || lastMessage.ask === "resume_completed_task") {
				lastMessage = this.state.claudeMessages[this.state.claudeMessages.length - 2]
			}

			// Check if last message is a tool message and specifically attempt_completion
			if (lastMessage.ask === "tool") {
				const toolData = JSON.parse(lastMessage.text ?? "{}") as ChatTool
				if (toolData.tool === "attempt_completion" && toolData.approvalState === "approved") {
					isTaskCompleted = true
				}
			}
		} catch (error) {}

		await this.providerRef
			.deref()
			?.getStateManager()
			.updateTaskHistory(
				{
					id: this.state.taskId,
					// ts: lastRelevantMessage?.ts,
					...(updateTs ? { ts: lastRelevantMessage?.ts } : {}),
					task: taskMessage.text ?? "",
					tokensIn: apiMetrics.totalTokensIn,
					tokensOut: apiMetrics.totalTokensOut,
					cacheWrites: apiMetrics.totalCacheWrites,
					cacheReads: apiMetrics.totalCacheReads,
					totalCost: apiMetrics.totalCost,
				},
				{
					lastMessageAt: lastRelevantMessage?.ts,
				}
			)
		return this.state.claudeMessages
	}

	public async deleteClaudeMessage(messageId: number, withFlush = true) {
		const index = this.state.claudeMessages.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(`[ClaudeMessagesManager] deleteClaudeMessage: Message with id ${messageId} not found`)
			return
		}
		// In-place deletion using splice
		this.state.claudeMessages.splice(index, 1)
		await this.saveClaudeMessages()
		if (withFlush) {
			const provider = this.safeProviderRef()
			await provider?.getWebviewManager()?.postClaudeMessagesToWebview(this.state.claudeMessages)
		}
		return this.state.claudeMessages
	}

	public getMessageById(messageId: number): ClaudeMessage | undefined {
		return this.state.claudeMessages.find((msg) => msg?.ts === messageId)
	}

	public async addToClaudeMessages(message: ClaudeMessage, withFlush = true) {
		if (isV1ClaudeMessage(message)) {
			message.agentName = this.stateManager.subAgentManager.agentName
			message.modelId = message.modelId ?? this.stateManager.apiManager.getModelId()
			if (message.isDone) {
				message.completedAt = Date.now()
			}
		}
		this.state.claudeMessages.push(message)
		await this.saveClaudeMessages()
		if (withFlush) {
			await this.providerRef.deref()?.getWebviewManager().postClaudeMessageToWebview(message)
		}
		return message
	}

	// Refactored to use in-place modifications
	public async overwriteClaudeMessages(
		newMessages: ClaudeMessage[],
		options?: OverwriteClaudeMessagesOptions,
		withFlush = true
	) {
		// We do it because the newMessages might be a reference to the same array
		const newMessagesCopy = [...newMessages]
		// Clear the existing array in-place
		this.state.claudeMessages.length = 0
		// Push the new messages into the now-empty array
		this.state.claudeMessages.push(...newMessagesCopy)
		await this.saveClaudeMessages(options?.updateTs, options?.updateIsDone)
		if (withFlush) {
			const provider = this.safeProviderRef()
			await provider?.getWebviewManager()?.postClaudeMessagesToWebview(this.state.claudeMessages)
		}
		return this.state.claudeMessages
	}

	// Refactored to use in-place modification (.length)
	public async removeEverythingAfterMessage(messageId: number, withFlush = true) {
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
		if (withFlush) {
			const provider = this.safeProviderRef()
			await provider?.getWebviewManager()?.postClaudeMessagesToWebview(this.state.claudeMessages)
		}
		return this.state.claudeMessages
	}

	public async updateClaudeMessage(messageId: number, message: ClaudeMessage, withFlush = true) {
		const index = this.state.claudeMessages.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(`[ClaudeMessagesManager] updateClaudeMessage: Message with id ${messageId} not found`)
			return
		}
		// Set completedAt when a message is marked as done
		if (isV1ClaudeMessage(message) && message.isDone && !message.completedAt) {
			message.completedAt = Date.now()
		}
		// In-place update of the message object
		this.state.claudeMessages[index] = message
		await this.saveClaudeMessages()
		// Update webview if requested
		if (withFlush) {
			await this.safePostMessage(message).catch((err) => console.error("Error posting message to webview:", err))
		}
		return this.state.claudeMessages[index]
	}

	public async appendToClaudeMessage(messageId: number, text: string, withFlush = true) {
		const lastMessage = this.state.claudeMessages.find((msg) => msg?.ts === messageId)
		if (lastMessage && lastMessage.type === "say") {
			lastMessage.text += text
			await this.saveClaudeMessages()

			// Update webview if requested
			if (withFlush) {
				await this.safePostMessage(lastMessage).catch((err) =>
					console.error("Error posting message to webview:", err)
				)
			}
			return lastMessage
		}
		return undefined
	}

	public async addToClaudeAfterMessage(messageId: number, message: ClaudeMessage, withFlush = true) {
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
		if (withFlush) {
			const provider = this.safeProviderRef()
			await provider?.getWebviewManager()?.postClaudeMessageToWebview(message)
		}
		return message
	}

	private safeProviderRef(): ExtensionProvider | undefined {
		try {
			const provider = this.providerRef.deref()
			if (!provider) {
				throw new Error("Provider is not available")
			}
			return provider
		} catch (err) {
			console.error("Provider is not available")
			return
		}
	}

	private async safePostMessage(message: ClaudeMessage): Promise<void> {
		try {
			const provider = this.safeProviderRef()
			if (provider) {
				await provider.getWebviewManager().postClaudeMessageToWebview(message)
			}
		} catch (err) {
			console.error("Error posting message to webview:", err)
		}
	}
}
