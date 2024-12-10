import { ClaudeAsk, ClaudeMessage, V1ClaudeMessage } from "../../../shared/extension-message"
import { ClaudeAskResponse } from "../../../shared/webview-message"
import { AskDetails, AskResponse } from "./utils"
import { StateManager } from "../state-manager"
import { ChatTool } from "../../../shared/new-tools"
import { WebviewManager } from "../../../providers/claude-coder/webview/webview-manager"
interface PendingAsk {
	resolve: (value: AskResponse) => void
	reject: (error: Error) => void
	message: V1ClaudeMessage
	toolId?: string
}

const safeParseJSON = (json: string): any => {
	try {
		return JSON.parse(json)
	} catch (error) {
		return null
	}
}

const safeJsonStringify = (data: any): string => {
	try {
		return JSON.stringify(data)
	} catch (error) {
		return ""
	}
}

export class AskManager {
	private readonly stateManager: StateManager
	private readonly webViewManager: WebviewManager
	private currentAsk: PendingAsk | null = null
	private currentAskId: number | null = null
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
		this.webViewManager = stateManager.providerRef.deref()!.getWebviewManager()
	}

	public async abortPendingAsks(): Promise<void> {
		const abortError = new Error("Task aborted")

		// Reject current ask if exists
		if (this.currentAsk) {
			const askData = this.stateManager.getMessageById(this.currentAskId!)
			if (askData) {
				try {
					const tool = (askData.ask === "tool" ? safeParseJSON(askData.text ?? "{}") : undefined) as ChatTool

					tool.approvalState = "error"
					tool.error = "Tool was aborted"
					await this.updateState(this.currentAskId!, "tool", tool, "error")
				} catch (err) {
					console.error("Error in abortPendingAsks:", err)
					await this.updateState(this.currentAskId!, "tool", undefined, "error")
				}
			} else {
				await this.updateState(this.currentAskId!, "tool", undefined, "error")
			}
			this.currentAsk.reject(abortError)
			this.currentAsk = null
			this.currentAskId = null
		}

		// Clear pending tool asks
		this.pendingToolAsks.clear()
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

		// Handle existing ask updates
		if (this.isExistingAskUpdate(askTs)) {
			return this.handleExistingAskUpdate(askTs!, type, tool)
		}

		// Handle new ask
		return this.handleNewAsk(id, type, question, tool)
	}

	public handleResponse(id: number, response: ClaudeAskResponse, text?: string, images?: string[]): void {
		// Try current ask first
		if (this.isCurrentAsk(id)) {
			this.resolveCurrentAsk(response, text, images)
			return
		}

		// Try tool ask
		if (this.isToolAskResponse(id)) {
			this.resolveToolAsk(id, response, text, images)
			return
		}

		// Fallback to current ask if no match
		if (this.currentAsk) {
			console.log(`No exact match found for response ${id}, using current ask ${this.currentAskId}`)
			this.resolveCurrentAsk(response, text, images)
			return
		}

		console.warn("No ask in progress to handle response", {
			responseId: id,
			currentAskId: this.currentAskId,
			pendingToolAsks: Array.from(this.pendingToolAsks.entries()),
		})
	}

	public dispose() {
		if (this.currentAsk) {
			this.currentAsk = null
			this.currentAskId = null
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

	private async handleExistingAskUpdate(askTs: number, type: ClaudeAsk, tool?: ChatTool): Promise<AskResponse> {
		await this.updateState(askTs, type, tool)
		return new Promise<AskResponse>((resolve, reject) => {
			if (this.currentAsk) {
				this.currentAsk.resolve = resolve
				this.currentAsk.reject = reject
				console.log(`Updated existing ask ${askTs}`)
			} else {
				resolve({ response: "messageResponse" })
			}
		})
	}

	private async handleNewAsk(id: number, type: ClaudeAsk, question?: string, tool?: ChatTool): Promise<AskResponse> {
		// Create and store new ask message
		const askMessage = this.createAskMessage(id, type, question, tool)
		await this.updateState(id, type, tool)

		return new Promise<AskResponse>((resolve, reject) => {
			this.currentAsk = {
				resolve,
				reject,
				message: askMessage,
				toolId: tool?.ts?.toString(),
			}
			this.currentAskId = id

			console.log(`Created new ask with id ${id}`, {
				type,
				question,
				tool: tool?.tool,
				toolId: tool?.ts,
			})
		})
	}

	private createAskMessage(id: number, type: ClaudeAsk, question?: string, tool?: ChatTool): V1ClaudeMessage {
		return {
			ts: id,
			type: "ask",
			ask: type,
			text: question ? question : tool ? safeJsonStringify(tool) : "",
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
			text: tool ? safeJsonStringify(tool) : "",
			v: 1,
			status: status === "approved" ? "approved" : tool?.approvalState,
			autoApproved: status === "approved",
		}
		try {
			if (this.stateManager.getMessageById(id)) {
				// we can void the promise here as we don't need to wait for the state to be updated
				await this.stateManager.updateClaudeMessage(id, message)
			} else {
				await this.stateManager.addToClaudeMessages(message)
			}
			await this.webViewManager.postClaudeMessageToWebview(message)
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
			!this.stateManager.temporayPauseAutomaticMode &&
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

	private isExistingAskUpdate(askTs?: number): boolean {
		return !!askTs && this.currentAskId === askTs
	}

	private isCurrentAsk(id: number): boolean {
		return this.currentAskId === id && !!this.currentAsk
	}

	private isToolAskResponse(id: number): boolean {
		if (!this.currentAsk) {
			return false
		}

		for (const [toolId, askId] of this.pendingToolAsks.entries()) {
			if (askId === id && this.currentAsk.toolId === toolId) {
				return true
			}
		}
		return false
	}

	private resolveCurrentAsk(response: ClaudeAskResponse, text?: string, images?: string[]) {
		if (!this.currentAsk) {
			return
		}

		const result: AskResponse = { response, text, images }
		this.currentAsk.resolve(result)

		this.currentAsk = null
		this.currentAskId = null
	}

	public hasActiveAsk(): boolean {
		return !!this.currentAsk
	}

	private resolveToolAsk(id: number, response: ClaudeAskResponse, text?: string, images?: string[]) {
		if (!this.currentAsk) {
			return
		}

		const result: AskResponse = { response, text, images }
		this.currentAsk.resolve(result)

		// Cleanup tool ask
		if (this.currentAsk.toolId) {
			this.pendingToolAsks.delete(this.currentAsk.toolId)
		}

		this.currentAsk = null
		this.currentAskId = null
	}
}
