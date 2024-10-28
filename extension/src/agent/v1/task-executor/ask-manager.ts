import { ClaudeAsk, V1ClaudeMessage } from "../../../shared/ExtensionMessage"
import { ClaudeAskResponse } from "../../../shared/WebviewMessage"
import { AskDetails, AskResponse } from "./utils"
import { StateManager } from "../state-manager"
import { ChatTool } from "../../../shared/new-tools"

interface PendingAsk {
	resolve: (value: AskResponse) => void
	reject: (error: Error) => void
	message: V1ClaudeMessage
	toolId?: string
}

export class AskManager {
	private readonly stateManager: StateManager
	private pendingAsks: Map<number, PendingAsk> = new Map()
	private pendingToolAsks: Map<string, number> = new Map()
	private readonly readOnlyTools = [
		"read_file",
		"list_files",
		"search_files",
		"list_code_definition_names",
		"web_search",
		"url_screenshot",
	] as const

	private readonly mustRequestApprovalTypes = [
		"completion_result",
		"resume_completed_task",
		"resume_task",
		"request_limit_reached",
		"followup",
	] as const

	private readonly mustRequestApprovalTools = ["ask_followup_question", "attempt_completion"] as const

	constructor(stateManager: StateManager) {
		this.stateManager = stateManager
	}

	public async ask(type: ClaudeAsk, data?: AskDetails, askTs?: number): Promise<AskResponse> {
		const id = askTs || Date.now()
		const { question, tool } = data ?? {}

		// Handle auto-approval first
		if (this.shouldAutoApprove(type, tool?.tool)) {
			await this.updateState(id, type, tool, "approved")
			return { response: "yesButtonTapped", text: "", images: [] }
		}

		// Track tool asks
		if (this.isToolAsk(type, tool)) {
			await this.trackToolAsk(id, tool)
		}

		// Create and store new ask message
		const askMessage = this.createAskMessage(id, type, question, tool)
		await this.updateState(id, type, tool)

		return new Promise<AskResponse>((resolve, reject) => {
			const pendingAsk: PendingAsk = {
				resolve,
				reject,
				message: askMessage,
				toolId: tool?.ts?.toString(),
			}

			this.pendingAsks.set(id, pendingAsk)
			console.log(`Created new ask with id ${id}`, {
				type,
				question,
				tool: tool?.tool,
				toolId: tool?.ts,
				pendingAsksSize: this.pendingAsks.size,
			})
		})
	}

	public handleResponse(id: number, response: ClaudeAskResponse, text?: string, images?: string[]) {
		console.log(`Handling response for ask ${id}`, {
			pendingAsksSize: this.pendingAsks.size,
			pendingToolAsksSize: this.pendingToolAsks.size,
			hasPendingAsk: this.pendingAsks.has(id),
		})

		const pendingAsk = this.pendingAsks.get(id)
		if (!pendingAsk) {
			console.warn(`No pending ask found for id ${id}`)
			return
		}

		const result: AskResponse = { response, text, images }
		pendingAsk.resolve(result)

		// Cleanup
		this.pendingAsks.delete(id)
		if (pendingAsk.toolId) {
			this.pendingToolAsks.delete(pendingAsk.toolId)
		}
	}

	public dispose() {
		// Resolve all pending asks with messageResponse
		for (const [id, ask] of this.pendingAsks) {
			ask.resolve({ response: "messageResponse" })
			this.pendingAsks.delete(id)
		}
		this.pendingToolAsks.clear()
	}

	private async trackToolAsk(id: number, tool?: ChatTool) {
		if (tool?.ts) {
			const toolId = tool.ts.toString()
			this.pendingToolAsks.set(toolId, id)
			console.log(`Tracking tool ask ${toolId} with ask id ${id}`)
		}
	}

	private createAskMessage(id: number, type: ClaudeAsk, question?: string, tool?: ChatTool): V1ClaudeMessage {
		return {
			ts: id,
			type: "ask",
			ask: type,
			text: question ? question : tool ? JSON.stringify(tool) : "",
			v: 1,
			status: tool?.approvalState,
			autoApproved: this.shouldAutoApprove(type, tool?.tool),
		}
	}

	private async updateState(
		id: number,
		type: ClaudeAsk,
		tool?: ChatTool,
		status: "pending" | "approved" | "error" = "pending"
	) {
		const message: V1ClaudeMessage = {
			ts: id,
			type: "ask",
			ask: type,
			text: tool ? JSON.stringify(tool) : "",
			v: 1,
			status: status === "approved" ? "approved" : tool?.approvalState,
			autoApproved: status === "approved",
		}

		try {
			if (this.stateManager.getMessageById(id)) {
				await this.stateManager.updateClaudeMessage(id, message)
			} else {
				await this.stateManager.addToClaudeMessages(message)
			}

			await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
		} catch (error) {
			console.error("Error in updateState:", error)
			throw error
		}
	}

	private shouldAutoApprove(type: ClaudeAsk, tool?: string): boolean {
		if (this.stateManager.alwaysAllowReadOnly && tool && this.readOnlyTools.includes(tool as any)) {
			return true
		}

		if (
			this.stateManager.alwaysAllowWriteOnly &&
			!this.mustRequestApprovalTypes.includes(type as any) &&
			(!tool || !this.mustRequestApprovalTools.includes(tool as any))
		) {
			return true
		}

		return false
	}

	private isToolAsk(type: ClaudeAsk, tool?: ChatTool): boolean {
		return type === "tool" && !!tool
	}
}
