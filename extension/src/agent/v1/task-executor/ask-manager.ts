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
	promise: Promise<AskResponse>
}

export class AskManager {
	private readonly stateManager: StateManager
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
		console.log("[AskManager] Initializing with state manager", {
			alwaysAllowReadOnly: stateManager.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: stateManager.alwaysAllowWriteOnly,
		})
		this.stateManager = stateManager
	}

	public async abortPendingAsks(): Promise<void> {
		console.log("[AskManager] Aborting pending asks", {
			currentAskId: this.currentAskId,
			hasPendingAsk: !!this.currentAsk,
			pendingToolAsksCount: this.pendingToolAsks.size,
		})

		const abortError = new Error("Task aborted")

		// Reject current ask if exists
		if (this.currentAsk) {
			await this.updateState(this.currentAskId!, "tool", undefined, "error")
			this.currentAsk.reject(abortError)
			this.currentAsk = null
			this.currentAskId = null
			console.log("[AskManager] Current ask rejected and cleared")
		}

		// Clear pending tool asks
		this.pendingToolAsks.clear()
		console.log("[AskManager] Pending tool asks cleared")
	}

	public async waitForPendingAsks(): Promise<void> {
		if (!this.currentAsk) {
			return
		}

		try {
			await this.currentAsk.promise
		} catch (error) {
			console.error("[AskManager] Error waiting for pending ask:", error)
			throw error
		}
	}

	public async ask(type: ClaudeAsk, data?: AskDetails, askTs?: number): Promise<AskResponse> {
		console.log("[AskManager] New ask request", {
			type,
			data,
			askTs,
			currentAskId: this.currentAskId,
			pendingToolAsksCount: this.pendingToolAsks.size,
		})

		const id = askTs || Date.now()
		const { question, tool } = data ?? {}

		// Handle auto-approval first
		if (this.shouldAutoApprove(type, tool?.tool)) {
			console.log("[AskManager] Auto-approving ask", { id, type, tool: tool?.tool })
			await this.updateState(id, type, tool, "approved")
			return { response: "yesButtonTapped", text: "", images: [] }
		}

		// Track tool asks
		if (this.isToolAsk(type, tool)) {
			console.log("[AskManager] Tracking tool ask", { id, tool: tool?.tool, toolTs: tool?.ts })
			await this.trackToolAsk(id, tool)
		}

		// Handle existing ask updates
		if (this.isExistingAskUpdate(askTs)) {
			console.log("[AskManager] Handling existing ask update", { askTs, type, tool: tool?.tool })
			return this.handleExistingAskUpdate(askTs!, type, tool)
		}

		// Handle new ask
		console.log("[AskManager] Handling new ask", { id, type, question, tool: tool?.tool })
		return this.handleNewAsk(id, type, question, tool)
	}

	public handleResponse(id: number, response: ClaudeAskResponse, text?: string, images?: string[]): void {
		console.log("[AskManager] Handling response", {
			id,
			response,
			hasText: !!text,
			imageCount: images?.length,
			currentAskId: this.currentAskId,
		})

		// Try current ask first
		if (this.isCurrentAsk(id)) {
			console.log("[AskManager] Resolving current ask", { id })
			this.resolveCurrentAsk(response, text, images)
			return
		}

		// Try tool ask
		if (this.isToolAskResponse(id)) {
			console.log("[AskManager] Resolving tool ask", { id })
			this.resolveToolAsk(id, response, text, images)
			return
		}

		// Fallback to current ask if no match
		if (this.currentAsk) {
			console.log(`[AskManager] No exact match found for response ${id}, using current ask ${this.currentAskId}`)
			this.resolveCurrentAsk(response, text, images)
			return
		}

		console.warn("[AskManager] No ask in progress to handle response", {
			responseId: id,
			currentAskId: this.currentAskId,
			pendingToolAsks: Array.from(this.pendingToolAsks.entries()),
		})
	}

	public dispose() {
		console.log("[AskManager] Disposing", {
			hadCurrentAsk: !!this.currentAsk,
			pendingToolAsksCount: this.pendingToolAsks.size,
		})
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
			console.log("[AskManager] Tracked tool ask", {
				toolId,
				askId: id,
				pendingToolAsksCount: this.pendingToolAsks.size,
			})
		}
	}

	private async handleExistingAskUpdate(askTs: number, type: ClaudeAsk, tool?: ChatTool): Promise<AskResponse> {
		console.log("[AskManager] Updating existing ask", { askTs, type, tool: tool?.tool })
		await this.updateState(askTs, type, tool)

		if (!this.currentAsk) {
			console.log("[AskManager] No current ask to update, resolving immediately", { askTs })
			return { response: "messageResponse" }
		}

		// Return the existing promise to ensure proper awaiting
		return this.currentAsk.promise
	}

	private async handleNewAsk(id: number, type: ClaudeAsk, question?: string, tool?: ChatTool): Promise<AskResponse> {
		console.log("[AskManager] Creating new ask", {
			id,
			type,
			question,
			tool: tool?.tool,
			toolTs: tool?.ts,
		})

		// Create and store new ask message
		const askMessage = this.createAskMessage(id, type, question, tool)
		await this.updateState(id, type, tool)

		let resolvePromise: (value: AskResponse) => void
		let rejectPromise: (error: Error) => void

		const promise = new Promise<AskResponse>((resolve, reject) => {
			resolvePromise = resolve
			rejectPromise = reject
		})

		this.currentAsk = {
			resolve: resolvePromise!,
			reject: rejectPromise!,
			message: askMessage,
			toolId: tool?.ts?.toString(),
			promise,
		}
		this.currentAskId = id

		console.log("[AskManager] Created new ask", {
			id,
			type,
			question,
			tool: tool?.tool,
			toolId: tool?.ts,
		})

		return promise
	}

	private createAskMessage(id: number, type: ClaudeAsk, question?: string, tool?: ChatTool): V1ClaudeMessage {
		const autoApproved = this.shouldAutoApprove(type, tool?.tool)
		console.log("[AskManager] Creating ask message", {
			id,
			type,
			hasQuestion: !!question,
			tool: tool?.tool,
			autoApproved,
		})

		return {
			ts: id,
			type: "ask",
			ask: type,
			text: question ? question : tool ? JSON.stringify(tool) : "",
			v: 1,
			status: tool?.approvalState,
			autoApproved,
		}
	}

	private async updateState(
		id: number,
		type: ClaudeAsk,
		tool?: ChatTool,
		status: "pending" | "approved" | "error" = "pending"
	) {
		console.log("[AskManager] Updating state", {
			id,
			type,
			tool: tool?.tool,
			status,
		})

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
			const existingMessage = this.stateManager.getMessageById(id)
			if (existingMessage) {
				console.log("[AskManager] Updating existing message", { id })
				await this.stateManager.updateClaudeMessage(id, message)
			} else {
				console.log("[AskManager] Adding new message", { id })
				await this.stateManager.addToClaudeMessages(message)
			}

			await this.stateManager.providerRef.deref()?.getWebviewManager()?.postStateToWebview()
			console.log("[AskManager] State updated and posted to webview", { id })
		} catch (error) {
			console.error("[AskManager] Error in updateState:", error)
			throw error
		}
	}

	private shouldAutoApprove(type: ClaudeAsk, tool?: string): boolean {
		const shouldApprove =
			(this.stateManager.alwaysAllowReadOnly && tool && this.readOnlyTools.includes(tool as any)) ||
			(this.stateManager.alwaysAllowWriteOnly &&
				!this.mustRequestApprovalTypes.includes(type as any) &&
				(!tool || !this.mustRequestApprovalTools.includes(tool as any)))

		console.log("[AskManager] Auto-approval check", {
			type,
			tool,
			shouldApprove,
			alwaysAllowReadOnly: this.stateManager.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: this.stateManager.alwaysAllowWriteOnly,
		})

		return shouldApprove
	}

	private isToolAsk(type: ClaudeAsk, tool?: ChatTool): boolean {
		const isToolAsk = type === "tool" && !!tool
		console.log("[AskManager] Tool ask check", { type, hasTool: !!tool, isToolAsk })
		return isToolAsk
	}

	private isExistingAskUpdate(askTs?: number): boolean {
		const isUpdate = !!askTs && this.currentAskId === askTs
		console.log("[AskManager] Existing ask update check", {
			askTs,
			currentAskId: this.currentAskId,
			isUpdate,
		})
		return isUpdate
	}

	private isCurrentAsk(id: number): boolean {
		const isCurrent = this.currentAskId === id && !!this.currentAsk
		console.log("[AskManager] Current ask check", {
			id,
			currentAskId: this.currentAskId,
			hasCurrentAsk: !!this.currentAsk,
			isCurrent,
		})
		return isCurrent
	}

	private isToolAskResponse(id: number): boolean {
		if (!this.currentAsk) {
			console.log("[AskManager] Tool ask response check failed - no current ask", { id })
			return false
		}

		for (const [toolId, askId] of this.pendingToolAsks.entries()) {
			if (askId === id && this.currentAsk.toolId === toolId) {
				console.log("[AskManager] Found matching tool ask", { id, toolId, askId })
				return true
			}
		}

		console.log("[AskManager] No matching tool ask found", {
			id,
			currentAskToolId: this.currentAsk.toolId,
			pendingToolAsks: Array.from(this.pendingToolAsks.entries()),
		})
		return false
	}

	private resolveCurrentAsk(response: ClaudeAskResponse, text?: string, images?: string[]) {
		if (!this.currentAsk) {
			console.log("[AskManager] Cannot resolve current ask - no ask in progress")
			return
		}

		console.log("[AskManager] Resolving current ask", {
			askId: this.currentAskId,
			response,
			hasText: !!text,
			imageCount: images?.length,
		})

		const result: AskResponse = { response, text, images }
		this.currentAsk.resolve(result)

		this.currentAsk = null
		this.currentAskId = null
		console.log("[AskManager] Current ask resolved and cleared")
	}

	private resolveToolAsk(id: number, response: ClaudeAskResponse, text?: string, images?: string[]) {
		if (!this.currentAsk) {
			console.log("[AskManager] Cannot resolve tool ask - no ask in progress", { id })
			return
		}

		console.log("[AskManager] Resolving tool ask", {
			id,
			toolId: this.currentAsk.toolId,
			response,
			hasText: !!text,
			imageCount: images?.length,
		})

		const result: AskResponse = { response, text, images }
		this.currentAsk.resolve(result)

		// Cleanup tool ask
		if (this.currentAsk.toolId) {
			this.pendingToolAsks.delete(this.currentAsk.toolId)
			console.log("[AskManager] Removed tool ask from pending", {
				toolId: this.currentAsk.toolId,
				remainingPendingCount: this.pendingToolAsks.size,
			})
		}

		this.currentAsk = null
		this.currentAskId = null
		console.log("[AskManager] Tool ask resolved and cleared")
	}
}
