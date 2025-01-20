import Anthropic from "@anthropic-ai/sdk"
import { ExtensionProvider } from "../../../providers/extension-provider"
import { KoduAgentState, ApiHistoryItem } from "../types"
import { IOManager } from "./io-manager"

interface ApiHistoryManagerOptions {
	state: KoduAgentState
	ioManager: IOManager
}

export class ApiHistoryManager {
	private state: KoduAgentState
	private ioManager: IOManager

	constructor(options: ApiHistoryManagerOptions) {
		this.state = options.state
		this.ioManager = options.ioManager
	}

	public async getSavedApiConversationHistory(fromDisk = false): Promise<ApiHistoryItem[]> {
		if (this.state.apiConversationHistory.length > 0 && !fromDisk) {
			return this.state.apiConversationHistory
		}
		const history = await this.ioManager.loadApiHistory()
		this.state.apiConversationHistory.length = 0
		// In-place update to preserve reference
		this.state.apiConversationHistory.push(...history)
		return this.state.apiConversationHistory
	}

	public async saveApiHistory() {
		await this.ioManager.saveApiHistory(this.state.apiConversationHistory)
	}

	public async addToApiConversationHistory(message: ApiHistoryItem) {
		if (message.ts === undefined) {
			message.ts = Date.now()
		}
		this.state.apiConversationHistory.push(message)
		await this.saveApiHistory()
		return message.ts
	}

	public async overwriteApiConversationHistory(newHistory: ApiHistoryItem[]) {
		// we do it because the newHistory might be a reference to the same array
		const newHistoryCopy = [...newHistory]
		// Clear the existing array in-place
		this.state.apiConversationHistory.length = 0
		// Push the new history items into the now-empty array
		this.state.apiConversationHistory.push(...newHistoryCopy)
		await this.saveApiHistory()
	}

	public async deleteApiHistoryItem(messageId: number) {
		const index = this.state.apiConversationHistory.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(`[ApiHistoryManager] deleteApiConversationHistory: Message with id ${messageId} not found`)
			return
		}
		this.state.apiConversationHistory.splice(index, 1)
		await this.saveApiHistory()
	}

	public async updateApiHistoryItem(messageId: number, message: ApiHistoryItem) {
		const index = this.state.apiConversationHistory.findIndex((msg) => msg?.ts === messageId)
		if (index === -1) {
			console.error(`[ApiHistoryManager] updateApiConversationHistory: Message with id ${messageId} not found`)
			return
		}
		// In-place update of the message object
		this.state.apiConversationHistory[index] = {
			...this.state.apiConversationHistory[index],
			...message,
		}
		await this.saveApiHistory()
	}
}
