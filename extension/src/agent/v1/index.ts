import { Anthropic } from "@anthropic-ai/sdk"
import { ExtensionProvider } from "../../providers/claude-coder/ClaudeCoderProvider"
import { isV1ClaudeMessage } from "../../shared/ExtensionMessage"
import { ToolName } from "../../shared/Tool"
import { ClaudeAskResponse } from "../../shared/WebviewMessage"
import { ApiManager } from "./api-handler"
import { ToolExecutor } from "./tools/tool-executor"
import { KoduDevOptions, ToolResponse, UserContent } from "./types"
import { getCwd, formatImagesIntoBlocks, getPotentiallyRelevantDetails, formatFilesList } from "./utils"
import { StateManager } from "./state-manager"
import { findLastIndex } from "../../utils"
import { amplitudeTracker } from "../../utils/amplitude"
import { ToolInput } from "./tools/types"
import { AdvancedTerminalManager } from "../../integrations/terminal"
import { BrowserManager } from "./browser-manager"
import { DiagnosticsHandler, GitHandler } from "./handlers"
import vscode from "vscode"
import path from "path"
import { TerminalRegistry } from "../../integrations/terminal/terminal-manager"
import os from "os"
import { arePathsEqual } from "../../utils/path-helpers"
import { listFiles } from "../../parse-source-code"
import { TaskExecutor } from "./task-executor/task-executor"
import { TaskState } from "./task-executor/utils"
import { ChatTool } from "../../shared/new-tools"
import delay from "delay"

// new KoduDev
export class KoduDev {
	private stateManager: StateManager
	private apiManager: ApiManager
	public toolExecutor: ToolExecutor
	public taskExecutor: TaskExecutor
	/**
	 * If the last api message caused a file edit
	 */
	public isLastMessageFileEdit: boolean = false
	public terminalManager: AdvancedTerminalManager
	public providerRef: WeakRef<ExtensionProvider>
	public browserManager: BrowserManager
	public isFirstMessage: boolean = true
	private isAborting: boolean = false
	public gitHandler: GitHandler

	constructor(
		options: KoduDevOptions & {
			noTask?: boolean
		}
	) {
		const { provider, apiConfiguration, customInstructions, task, images, historyItem } = options
		this.stateManager = new StateManager(options)
		this.stateManager.setState({
			taskId: historyItem ? historyItem.id : Date.now().toString(),
			dirAbsolutePath: historyItem?.dirAbsolutePath ?? "",
			isRepoInitialized: historyItem?.isRepoInitialized ?? false,
			requestCount: 0,
			apiConversationHistory: [],
			claudeMessages: [],
			abort: false,
		})
		this.providerRef = new WeakRef(provider)
		this.apiManager = new ApiManager(provider, apiConfiguration, customInstructions)
		this.toolExecutor = new ToolExecutor({
			cwd: getCwd(),
			alwaysAllowReadOnly: this.stateManager.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: this.stateManager.alwaysAllowWriteOnly,
			koduDev: this,
		})
		this.terminalManager = new AdvancedTerminalManager()
		this.taskExecutor = new TaskExecutor(this.stateManager, this.toolExecutor, this.providerRef)
		this.browserManager = new BrowserManager(this.providerRef.deref()!.context)

		this.setupTaskExecutor()
		this.gitHandler = new GitHandler(getCwd(), this.stateManager, this.apiManager)

		amplitudeTracker.updateUserSettings({
			AlwaysAllowReads: this.stateManager.alwaysAllowReadOnly,
			AutomaticMode: this.stateManager.alwaysAllowWriteOnly,
			AutoSummarize: this.stateManager.autoSummarize,
		})

		if (historyItem?.dirAbsolutePath) {
		}

		if (options.noTask) {
			return
		}
		if (historyItem) {
			this.stateManager.state.isHistoryItem = true
			this.resumeTaskFromHistory()
			this.gitHandler.init()
		} else if (task || images) {
			this.startTask(task, images)
		} else {
			throw new Error("Either historyItem or task/images must be provided")
		}
	}

	public getStateManager() {
		return this.stateManager
	}

	public getApiManager() {
		return this.apiManager
	}

	private setupTaskExecutor() {
		// Pass necessary methods to the TaskExecutor
		this.taskExecutor = new TaskExecutor(this.stateManager, this.toolExecutor, this.providerRef)
	}

	async handleWebviewAskResponse(askResponse: ClaudeAskResponse, text?: string, images?: string[]) {
		if (this.isAborting) {
			return
		}
		if (this.taskExecutor.state === TaskState.ABORTED && (text || images)) {
			let textBlock: Anthropic.TextBlockParam = {
				type: "text",
				text: text ?? "",
			}
			let imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
			if (textBlock.text.trim() === "" && imageBlocks.length > 1) {
				textBlock.text =
					"Please check the images below for more information and continue the task from where we left off."
			}
			if (textBlock.text.trim() === "") {
				textBlock.text = "Please continue the task from where we left off."
			}
			await this.taskExecutor.newMessage([textBlock, ...imageBlocks])
			return
		}
		if (
			(this.taskExecutor.state === TaskState.WAITING_FOR_USER || this.taskExecutor.state === TaskState.IDLE) &&
			askResponse === "messageResponse" &&
			!this.taskExecutor.askManager.hasActiveAsk()
		) {
			await this.taskExecutor.newMessage([
				{
					type: "text",
					text:
						text ?? images?.length
							? "Please check the images below for more information."
							: "Continue the task.",
				},
				...formatImagesIntoBlocks(images),
			])
			return
		}
		this.taskExecutor.handleAskResponse(askResponse, text, images)
	}
	public async startTask(task?: string, images?: string[]): Promise<void> {
		if (this.isAborting) {
			throw new Error("Cannot start task while aborting")
		}
		this.stateManager.state.claudeMessages = []
		this.stateManager.state.apiConversationHistory = []
		await this.providerRef.deref()?.getWebviewManager().postStateToWebview()

		let textBlock: Anthropic.TextBlockParam = {
			type: "text",
			text: `<task>\n${task}\n</task>\n\n${getPotentiallyRelevantDetails()}`,
		}
		let imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
		amplitudeTracker.taskStart(this.stateManager.state.taskId)

		await this.taskExecutor.say("text", task, images)
		await this.taskExecutor.startTask([textBlock, ...imageBlocks])
	}

	async resumeTaskFromHistory() {
		if (this.isAborting) {
			throw new Error("Cannot resume task while aborting")
		}
		const modifiedClaudeMessages = await this.stateManager.getSavedClaudeMessages()

		const lastRelevantMessageIndex = findLastIndex(
			modifiedClaudeMessages,
			(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")
		)
		if (lastRelevantMessageIndex !== -1) {
			modifiedClaudeMessages.splice(lastRelevantMessageIndex + 1)
		}
		let isFetchingInturrupted = false
		// if there is any message that is fetching, mark it as done and remove the next messages
		modifiedClaudeMessages.forEach((m) => {
			if (isV1ClaudeMessage(m)) {
				m.isDone = true
				if (m.say === "api_req_started" && m.isFetching) {
					isFetchingInturrupted = true
					m.isFetching = false
					m.isDone = true
					m.isError = true
					m.errorText = "Task was interrupted before this API request could be completed."
				}
				if (m.isFetching) {
					m.isFetching = false
					isFetchingInturrupted = true
					m.errorText = "Task was interrupted before this API request could be completed."
					m.isAborted = "user"
					m.isError = true
				}
				if (m.ask === "tool" && m.type === "ask") {
					try {
						const parsedTool = JSON.parse(m.text ?? "{}") as ChatTool | string
						if (typeof parsedTool === "object" && parsedTool.tool === "attempt_completion") {
							parsedTool.approvalState = "approved"
							m.text = JSON.stringify(parsedTool)
							return
						}
						if (
							typeof parsedTool === "object" &&
							(parsedTool.approvalState === "pending" ||
								parsedTool.approvalState === undefined ||
								parsedTool.approvalState === "loading")
						) {
							const toolsToSkip: ChatTool["tool"][] = ["ask_followup_question"]
							if (toolsToSkip.includes(parsedTool.tool)) {
								parsedTool.approvalState = "error"
								m.text = JSON.stringify(parsedTool)
								return
							}
							parsedTool.approvalState = "error"
							parsedTool.error = "Task was interrupted before this tool call could be completed."
							m.text = JSON.stringify(parsedTool)
						}
					} catch (err) {
						m.text = "{}"
						m.errorText = "Task was interrupted before this tool call could be completed."
						m.isError = true
					}
				}
			}
		})
		await this.stateManager.overwriteClaudeMessages(modifiedClaudeMessages)
		this.stateManager.state.claudeMessages = await this.stateManager.getSavedClaudeMessages()

		const lastClaudeMessage = this.stateManager.state.claudeMessages
			.slice()
			.reverse()
			.find((m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"))

		const isCompleted =
			lastClaudeMessage?.ask === "completion_result" ||
			(lastClaudeMessage &&
				isV1ClaudeMessage(lastClaudeMessage) &&
				lastClaudeMessage.ask === "tool" &&
				(JSON.parse(lastClaudeMessage.text ?? "{}") as ChatTool).tool === "attempt_completion")

		await this.providerRef.deref()?.getWebviewManager().postStateToWebview()
		const ts = Date.now()
		let { response, text, images } = await this.taskExecutor.askWithId(
			isCompleted ? "resume_completed_task" : "resume_task",
			undefined,
			ts
		)

		// remove the last ask after it's been answered
		const modifiedClaudeMessagesAfterResume = await this.stateManager.getSavedClaudeMessages()
		const lastAskIndex = modifiedClaudeMessagesAfterResume.findIndex((m) => m.ts === ts)
		if (lastAskIndex !== -1) {
			modifiedClaudeMessagesAfterResume.splice(lastAskIndex, 1)
		}
		await this.stateManager.overwriteClaudeMessages(modifiedClaudeMessagesAfterResume)

		let newUserContent: UserContent = []
		if (response === "messageResponse") {
			if (!text || text.trim() === "" || text === "null" || text === "undefined") {
				text = undefined
			}
			if (!images || images.length === 0) {
				images = undefined
			}
			await this.taskExecutor.say("user_feedback", text, images)
			if (images && images.length > 0) {
				newUserContent.push(...formatImagesIntoBlocks(images))
			}
			if (text) {
				newUserContent.push({ type: "text", text })
			}
		}
		if (response === "yesButtonTapped") {
			newUserContent.push({ type: "text", text: `Let's continue the task from where we left off.` })
		}
		const existingApiConversationHistory: Anthropic.Messages.MessageParam[] =
			await this.stateManager.getSavedApiConversationHistory()

		// remove all the corrupted messages (if there is a message with empty content)
		const modifiedApiConversationHistory = existingApiConversationHistory.filter((m) => {
			let shouldKeep = true
			if (typeof m.content === "string") {
				shouldKeep = m.content.trim() !== ""
			}
			if (Array.isArray(m.content) && m.content.length > 1) {
				shouldKeep = m.content.some(
					(block) => (block.type === "text" && block.text.trim() !== "") || block.type === "image"
				)
			}
			return shouldKeep
		})
		await this.stateManager.overwriteApiConversationHistory(modifiedApiConversationHistory) // remove the corrupted messages

		const newUserContentText = newUserContent.find((block) => block.type === "text")?.text
		const agoText = (() => {
			const timestamp = lastClaudeMessage?.ts ?? Date.now()
			const now = Date.now()
			const diff = now - timestamp
			const minutes = Math.floor(diff / 60000)
			const hours = Math.floor(minutes / 60)
			const days = Math.floor(hours / 24)

			if (days > 0) {
				return `${days} day${days > 1 ? "s" : ""} ago`
			}
			if (hours > 0) {
				return `${hours} hour${hours > 1 ? "s" : ""} ago`
			}
			if (minutes > 0) {
				return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
			}
			return "just now"
		})()

		let combinedText =
			`Task resumption: This autonomous coding task was interrupted ${agoText}. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. The current working directory is now ${getCwd()}. If the task has not been completed, retry the last step before interruption and proceed with completing the task.` +
			(newUserContentText
				? `\n\nNew instructions for task continuation:\n<user_message>\n${newUserContentText}\n</user_message>\n`
				: "")
		combinedText += `\n\n`
		combinedText += await this.getEnvironmentDetails(true)
		combinedText += `No dev server information is available. Please start the dev server if needed.`

		const pastRequestsCount = modifiedApiConversationHistory.filter((m) => m.role === "assistant").length
		amplitudeTracker.taskResume(this.stateManager.state.taskId, pastRequestsCount)

		this.stateManager.state.isHistoryItemResumed = true
		await this.taskExecutor.startTask(newUserContent)
	}

	async abortTask() {
		if (this.isAborting) {
			return
		}

		this.isAborting = true
		try {
			// First abort the task executor
			await this.taskExecutor.abortTask()

			// Then close the browser
			await this.browserManager.closeBrowser()

			// Then dispose terminals
			await this.terminalManager.disposeAll()

			// Finally clear dev servers
			await TerminalRegistry.clearAllDevServers()
		} finally {
			this.isAborting = false
		}
	}

	async rollbackToCheckpoint(ts: number, commitHash: string, branch: string) {
		// we first need to check if this ts exists in the history
		const message = this.stateManager.state.claudeMessages.find((m) => m.ts === ts)
		const apiConversationHistory = await this.stateManager.getSavedApiConversationHistory()
		const apiCommitHash = apiConversationHistory.find((m) => m.commitHash === commitHash)
		if (!message || !apiCommitHash) {
			throw new Error("Message not found, cannot rollback")
		}

		console.log(`[ROLLBACK] Attempting rollback to checkpoint`, { ts, commitHash, branch })

		// Get current branch name for safety
		const currentBranch = await this.gitHandler.getCurrentBranch()
		if (!currentBranch) {
			throw new Error("Failed to get current branch name")
		}

		// Create a temporary branch name for safety
		const tempBranchName = `temp-rollback-${Date.now()}`

		try {
			// First create a temporary branch at the target commit
			const createTempBranchSuccess = await this.gitHandler.createBranchAtCommit(tempBranchName, commitHash)
			if (!createTempBranchSuccess) {
				throw new Error(`Failed to create temporary branch at commit ${commitHash}`)
			}

			// Checkout to our temporary branch
			const checkoutSuccess = await this.gitHandler.checkoutTo(tempBranchName)
			if (!checkoutSuccess) {
				throw new Error(`Failed to checkout to temporary branch ${tempBranchName}`)
			}

			// Verify we're at the correct commit
			const currentCommit = await this.gitHandler.getCurrentCommit()
			// the commit hash is a short hash, so we need to check if the current commit starts with the commit hash
			if (!currentCommit || !currentCommit.startsWith(commitHash)) {
				throw new Error(`Failed to checkout to correct commit. Expected ${commitHash}, got ${currentCommit}`)
			}

			// Find the index of the message we're rolling back to
			const messageIndex = this.stateManager.state.claudeMessages.findIndex((m) => m.ts === ts)
			if (messageIndex === -1) {
				throw new Error("Failed to find message index")
			}
			// checkout to the target branch first before we start deleting messages
			const finalCheckoutSuccess = await this.gitHandler.checkoutTo(branch)
			if (!finalCheckoutSuccess) {
				throw new Error(`Failed to checkout to target branch ${branch}`)
			}

			// Keep only messages up to and including the rollback point
			const updatedClaudeMessages = this.stateManager.state.claudeMessages.slice(0, messageIndex + 1)
			await this.stateManager.overwriteClaudeMessages(updatedClaudeMessages)

			// Find index in API conversation history
			const apiHistoryIndex = apiConversationHistory.findIndex((m) => m.commitHash === commitHash)
			if (apiHistoryIndex === -1) {
				throw new Error("Failed to find API history index")
			}

			// Keep only API history up to and including the rollback point
			const updatedApiHistory = apiConversationHistory.slice(0, apiHistoryIndex + 1)
			await this.stateManager.overwriteApiConversationHistory(updatedApiHistory)

			// Reset the target branch to our verified commit state
			const resetSuccess = await this.gitHandler.resetHardTo(commitHash)
			if (!resetSuccess) {
				throw new Error(`Failed to reset ${branch} to commit ${commitHash}`)
			}

			console.log(`[ROLLBACK] Successfully rolled back to checkpoint`, {
				ts,
				commitHash,
				branch,
				messageCount: updatedClaudeMessages.length,
				apiHistoryCount: updatedApiHistory.length,
				fromBranch: currentBranch,
			})
			// we must update the webview to reflect the changes
			await this.providerRef.deref()?.getWebviewManager().postStateToWebview()
			vscode.window.showInformationMessage(`Successfully rolled back to checkpoint at commit ${commitHash}`)
			return true
		} catch (error) {
			console.error(`[ROLLBACK] Failed to rollback:`, error)
			// Attempt to restore to previous state
			try {
				vscode.window.showErrorMessage(
					`Failed to rollback to checkpoint. Please manually checkout to branch ${currentBranch}`
				)
				console.log(`[ROLLBACK] Attempting to restore to original branch ${currentBranch}`)
				await this.gitHandler.checkoutTo(currentBranch)
			} catch (restoreError) {
				vscode.window.showErrorMessage(
					`Failed to rollback to checkpoint. Please manually checkout to branch ${currentBranch}`
				)
				console.error(`[ROLLBACK] Failed to restore to previous branch:`, restoreError)
			}
			throw error
		} finally {
			// Cleanup: try to delete temporary branch if it exists
			try {
				await this.gitHandler.deleteBranch(tempBranchName)
			} catch (cleanupError) {
				console.error(`[ROLLBACK] Failed to cleanup temporary branch:`, cleanupError)
			}
		}
	}

	async getEnvironmentDetails(includeFileDetails: boolean = true) {
		let details = ""
		const lastTwoMsgs = this.stateManager.state.apiConversationHistory.slice(-2)
		const awaitRequierdTools: ToolName[] = ["execute_command", "write_to_file", "edit_file_blocks"]
		const isLastMsgMutable = lastTwoMsgs.some((msg) => {
			if (Array.isArray(msg.content)) {
				return msg.content.some(
					(block) =>
						block.type === "text" && awaitRequierdTools.map((i) => `<${i}>`).includes(block.text as any)
				)
			}
			if (typeof msg.content === "string") {
				return awaitRequierdTools.map((i) => `<${i}>`).includes(msg.content)
			}
			return false
		})
		if (isLastMsgMutable) {
			// proper delay to make sure that the vscode diagnostics and server logs are updated
			await delay(3000)
		}
		const devServers = TerminalRegistry.getAllDevServers()
		const isDevServerRunning = devServers.length > 0
		let devServerSection =
			"# Critical information about the current running development server, when you call the dev_server tool, the dev server information will be updated here. this is the only place where the dev server information will be updated. don't ask the user for information about the dev server, always refer to this section.\n"
		devServerSection += `\n\n<dev_server_status>\n`
		devServerSection += `<dev_server_running>${
			isDevServerRunning ? "SERVER IS RUNNING" : "SERVER IS NOT RUNNING!"
		}</dev_server_running>\n`
		if (isDevServerRunning) {
			for (const server of devServers) {
				const logs = server.logs.slice(-10)
				const serverName = server.terminalInfo.name
				devServerSection += `<dev_server_info>\n`
				devServerSection += `<server_name>${serverName}</server_name>\n`
				devServerSection += `<dev_server_url>${server.url}</dev_server_url>\n`
				devServerSection += `<dev_server_logs>${
					logs.length === 0
						? "No logs"
						: `
					You have a total of ${logs.length} logs. Here are the last 15 logs
					if you want to get the full logs use the dev_server tool.
					:\n` + logs.join("\n")
				}</dev_server_logs>\n`
				devServerSection += `</dev_server_info>\n`
			}
		} else {
			devServerSection += `<dev_server_info>Dev server is not running. Please start the dev server using the dev_server tool if needed.</dev_server_info>\n`
		}
		devServerSection += `</dev_server_status>\n`
		details += devServerSection
		// It could be useful for cline to know if the user went from one or no file to another between messages, so we always include this context
		details += "\n\n# VSCode Visible Files"
		const visibleFiles = vscode.window.visibleTextEditors
			?.map((editor) => editor.document?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(getCwd(), absolutePath).toPosix())
			.join("\n")
		if (visibleFiles) {
			details += `\n${visibleFiles}`
		} else {
			details += "\n(No visible files)"
		}

		details += "\n\n# VSCode Open Tabs"
		const openTabs = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(getCwd(), absolutePath).toPosix())
			.join("\n")
		if (openTabs) {
			details += `\n${openTabs}`
		} else {
			details += "\n(No open tabs)"
		}

		// get the diagnostics errors for all files in the current task

		const diagnosticsHandler = DiagnosticsHandler.getInstance()
		const files = this.stateManager.historyErrors ? Object.keys(this.stateManager.historyErrors) : []
		const diagnostics = diagnosticsHandler.getDiagnostics(files)
		const newErrors = diagnostics.filter(
			(diag) => diag.errorString !== null && diag.errorString !== undefined && diag.errorString !== ""
		)
		const taskErrorsRecord = newErrors.reduce((acc, curr) => {
			acc[curr.key] = {
				lastCheckedAt: Date.now(),
				error: curr.errorString!,
			}
			return acc
		}, {} as NonNullable<typeof this.stateManager.historyErrors>)
		this.stateManager.historyErrors = taskErrorsRecord
		if (newErrors.length === 0) {
			console.log(`[ENVIRONMENT DETAILS] No errors found`)
		} else {
			console.log(`[ENVIRONMENT DETAILS] Errors found:`, newErrors.map((diag) => diag.errorString).join("\n"))
		}

		// map the diagnostics to the original file path
		details +=
			"\n\n# CURRENT ERRORS (Linter Errors) this is the only errors that are present if you seen previous linting errors they have been resolved."
		if (newErrors.length === 0) {
			details += "\n(No diagnostics errors)"
		} else {
			console.log("[ENVIRONMENT DETAILS] New errors found", newErrors.map((diag) => diag.errorString).join("\n"))
			details += `The following errors are present in the current task you have been working on. this is the only errors that are present if you seen previous linting errors they have been resolved.\n`
			details += `<linter_errors>\n`
			details += newErrors.map((diag) => diag.errorString).join("\n")
			details += `</linter_errors>\n`
		}

		if (includeFileDetails) {
			details += `\n\n# Current Working Directory (${getCwd().toPosix()}) Files\n`
			const isDesktop = arePathsEqual(getCwd(), path.join(os.homedir(), "Desktop"))
			if (isDesktop) {
				// don't want to immediately access desktop since it would show permission popup
				details += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
			} else {
				const [files, didHitLimit] = await listFiles(getCwd(), true, 500)
				const result = formatFilesList(getCwd(), files, didHitLimit)

				details += result
			}
		}

		return `<environment_details>\n${details.trim()}\n</environment_details>`
	}
}

export * from "./types"
