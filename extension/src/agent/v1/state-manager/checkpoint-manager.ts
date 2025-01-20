// import Anthropic from "@anthropic-ai/sdk"
// import { CheckpointEntry, Checkpoint } from "../types"
// import { StateManager } from "."

// export class CheckpointManager {
// 	private stateManager: StateManager
// 	private enteries: CheckpointEntry[] = []

// 	constructor(options: StateManager) {
// 		this.stateManager = options
// 		this.loadCheckpoint(this.stateManager.taskId)
// 	}

// 	public async appendEntry(entry: CheckpointEntry) {
// 		this.enteries.push(entry)
// 	}

// 	public async saveCheckpoint() {
// 		const checkpoint: Checkpoint = {
// 			taskId: this.stateManager.taskId,
// 			enteries: this.enteries,
// 		}
// 		await this.stateManager.ioManager.saveCheckpoint(checkpoint)
// 	}

// 	public async loadCheckpoint(taskId: string): Promise<Checkpoint | undefined> {
// 		const checkpoint = await this.stateManager.ioManager.loadCheckpoint(taskId)
// 		if (!checkpoint) {
// 			return
// 		}
// 		this.enteries = checkpoint.enteries
// 		return checkpoint
// 	}

// 	public async clearCheckpoint() {
// 		this.enteries = []
// 	}

// 	public async rollbackCheckpoint(ts: number) {
// 		const indexOfEntry = this.enteries.findIndex((entry) => entry.content.ts === ts)
// 		if (indexOfEntry === -1) {
// 			return {
// 				error: new Error(`Checkpoint with ts ${ts} not found`),
// 				data: null,
// 			}
// 		}
// 		const entry = this.enteries[indexOfEntry]
// 		const position = this.enteries.length - indexOfEntry
// 		this.enteries = this.enteries.slice(0, indexOfEntry)
// 		const checkpoint: Checkpoint = {
// 			taskId: this.stateManager.taskId,
// 			enteries: this.enteries,
// 		}
// 		await this.stateManager.ioManager.saveCheckpoint(checkpoint)

// 		// overwrite the current api history, claude messages, sub-agent state and error state
// 		const apiHistory = this.enteries.map((entry) => entry.content)
// 		await this.stateManager.apiHistoryManager.overwriteApiConversationHistory(apiHistory)
// 		// remove all messages after ts
// 		const claudeMessages = await this.stateManager.claudeMessagesManager.getSavedClaudeMessages()
// 		const messages = claudeMessages.filter((message) => message.ts < ts)
// 		await this.stateManager.claudeMessagesManager.overwriteClaudeMessages(messages)
// 		// rollback to last message sub agent state and error state
// 		const subAgentState = await this.stateManager.ioManager.loadSubAgentState()
// 		if (subAgentState) {
// 			const lastState = subAgentState.states.find((state) => state.ts < ts)
// 			if (lastState) {
// 				await this.stateManager.subAgentManager.overwriteState(lastState)
// 			}
// 		}

// 		return {
// 			error: null,
// 			data: {
// 				checkpoint,
// 				rolledPosition: position,
// 			},
// 		}
// 	}
// }
