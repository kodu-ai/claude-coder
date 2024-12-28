import { Anthropic } from "@anthropic-ai/sdk"
import { ExtensionProvider } from "../../providers/extension-provider"
import { isV1ClaudeMessage } from "../../shared/messages/extension-message"
import { ClaudeAskResponse } from "../../shared/messages/client-message"
import { ApiManager } from "../../api/api-handler"
import { ToolExecutor } from "./tools/tool-executor"
import { KoduDevOptions, ToolResponse, UserContent } from "./types"
import { getCwd, formatImagesIntoBlocks, formatFilesList } from "./utils"
import { StateManager } from "./state-manager"
import { findLastIndex } from "../../utils"
import { amplitudeTracker } from "../../utils/amplitude"
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
import { ToolName } from "./tools/types"
import { DIFF_VIEW_URI_SCHEME } from "../../integrations/editor/decoration-controller"
import { HookManager, BaseHook, HookOptions, HookConstructor } from "./hooks"
import { ObserverHook } from "./hooks/observer-hook"
import { GlobalStateManager } from "../../providers/state/global-state-manager"
import dedent from "dedent"

// new KoduDev
export class KoduDev {
	private stateManager: StateManager
	private apiManager: ApiManager
	private hookManager: HookManager
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
			interestedFiles: [],
			historyErrors: {},
			abort: false,
		})
		this.providerRef = new WeakRef(provider)
		this.apiManager = new ApiManager(provider, apiConfiguration, customInstructions)
		// Initialize hook manager
		this.hookManager = new HookManager(this)

		const triggerEvery = GlobalStateManager.getInstance().getGlobalState("observerHookEvery")

		// Initialize default hooks
		if (!options.noTask && triggerEvery) {
			// Add diagnostic hook by default
			this.hookManager.registerHook(ObserverHook, {
				hookName: "observer",
				triggerEvery,
			})
		}
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
		this.gitHandler = new GitHandler(getCwd())

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
			this.providerRef.deref()?.getWebviewManager().postBaseStateToWebview()
		} else if (task || images) {
			this.startTask(task, images)
			this.providerRef.deref()?.getWebviewManager().postBaseStateToWebview()
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

	public getHookManager() {
		return this.hookManager
	}

	/**
	 * Execute hooks and get injected content
	 */
	public async executeHooks(): Promise<string | null> {
		return this.hookManager.checkAndExecuteHooks()
	}

	/**
	 * Register a new hook
	 */
	public registerHook<T extends BaseHook>(HookClass: HookConstructor<T>, options: HookOptions): T {
		return this.hookManager.registerHook(HookClass, options)
	}

	/**
	 * Remove a hook by name
	 */
	public removeHook(hookName: string): void {
		this.hookManager.removeHook(hookName)
	}

	/**
	 * Get a hook by name
	 */
	public getHook(hookName: string): BaseHook | undefined {
		return this.hookManager.getHook(hookName)
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

		let textBlock: Anthropic.TextBlockParam = {
			type: "text",
			text: `Here is our task for this conversation, you must remember it all time unless i tell you otherwise.\n<task>\n${task}\n</task>`,
		}
		let imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
		amplitudeTracker.taskStart(this.stateManager.state.taskId)
		await this.taskExecutor.say("text", task, images)
		await this.taskExecutor.startTask([textBlock, ...imageBlocks])
	}

	// FIXME: this function breaks prompt cache i think. or attempt completion is breaking the cache
	async resumeTaskFromHistory() {
		if (this.isAborting) {
			throw new Error("Cannot resume task while aborting")
		}
		const modifiedClaudeMessages = await this.stateManager.claudeMessagesManager.getSavedClaudeMessages()

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
		await this.stateManager.claudeMessagesManager.overwriteClaudeMessages(modifiedClaudeMessages)
		this.stateManager.state.claudeMessages = await this.stateManager.claudeMessagesManager.getSavedClaudeMessages()

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

		await this.providerRef
			.deref()
			?.getWebviewManager()
			.postClaudeMessagesToWebview(this.stateManager.state.claudeMessages)
		await this.providerRef.deref()?.getWebviewManager().postBaseStateToWebview()
		const ts = Date.now()
		let { response, text, images } = await this.taskExecutor.ask(
			isCompleted ? "resume_completed_task" : "resume_task",
			undefined,
			ts
		)

		// remove the last ask after it's been answered
		const modifiedClaudeMessagesAfterResume = await this.stateManager.claudeMessagesManager.getSavedClaudeMessages()
		const lastAskIndex = modifiedClaudeMessagesAfterResume.findIndex((m) => m.ts === ts)
		if (lastAskIndex !== -1) {
			modifiedClaudeMessagesAfterResume.splice(lastAskIndex, 1)
		}
		await this.stateManager.claudeMessagesManager.overwriteClaudeMessages(modifiedClaudeMessagesAfterResume)
		await this.providerRef
			.deref()
			?.getWebviewManager()
			.postClaudeMessagesToWebview(modifiedClaudeMessagesAfterResume)

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
			await this.stateManager.apiHistoryManager.getSavedApiConversationHistory()

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
		await this.stateManager.apiHistoryManager.overwriteApiConversationHistory(modifiedApiConversationHistory) // remove the corrupted messages

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
		void this.taskExecutor.startTask(newUserContent)
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

	/**
	 * checks if the file exists in the task history
	 * if it exists it check if the original file exists
	 * if task history file exists and the original file exists it opens a diff view between them
	 * if the task history file exists and the original file does not exist it still opens the file in a diff view
	 * if the task history file does not exist it shows an error message
	 */
	async viewFileInDiff(filePath: string, version: string) {
		const verNum = parseInt(version, 10)
		if (isNaN(verNum)) {
			vscode.window.showErrorMessage(`Invalid version number: ${version}`)
			return
		}

		const versions = await this.stateManager.getFileVersions(filePath)
		const targetVersion = versions.find((v) => v.version === verNum)
		if (!targetVersion) {
			vscode.window.showErrorMessage(`Version ${version} not found for file ${filePath}`)
			return
		}

		const absolutePath = path.resolve(this.stateManager.dirAbsolutePath ?? "", filePath)
		let originalContent = ""
		try {
			const fileUri = vscode.Uri.file(absolutePath)
			const doc = await vscode.workspace.openTextDocument(fileUri)
			originalContent = doc.getText()
		} catch {
			// file doesn't exist locally, originalContent stays empty
		}

		const leftData = Buffer.from(originalContent, "utf-8").toString("base64")
		const rightData = Buffer.from(targetVersion.content, "utf-8").toString("base64")

		const leftUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${path.basename(filePath)}?${leftData}`)
		const rightUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${path.basename(filePath)}_v${version}?${rightData}`)

		await vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, `${filePath} (local ↔ v${version})`)
	}

	observerHookEvery(value?: number) {
		// if not value is provided, we disable the observer hook
		if (!value) {
			this.hookManager.removeHook("observer")
			return
		}
		// check if the observer hook is already registered
		if (this.hookManager.hasHook("observer")) {
			this.hookManager.getHook("observer")?.updateOptions({ triggerEvery: value })
		} else {
			this.hookManager.registerHook(ObserverHook, { hookName: "observer", triggerEvery: value })
		}
	}

	/**
	 * current impelementation isn't working as expected requires better data structure to store the file versions and context if the file existed before or not
	 * Rollback to a specific checkpoint:
	 *  - Validate version number and existence
	 *  - Find the message by ts and remove all messages (Claude and API) after it
	 *  - For each file in the task:
	 *    - Find the highest version <= requested version
	 *    - Revert file content to that version using vscode.workspace.applyEdit
	 *  - Save updated conversation history
	 *  - Show success message
	 */
	async rollbackToCheckpoint(filePath: string, version: string, ts: number) {
		const verNum = parseInt(version, 10)
		if (isNaN(verNum)) {
			vscode.window.showErrorMessage(`Invalid version number: ${version}`)
			return
		}
		const versions = await this.stateManager.getFileVersions(filePath)
		const targetVersion = versions.find((v) => v.version === verNum)
		if (!targetVersion) {
			vscode.window.showErrorMessage(`Version ${version} not found for file ${filePath}`)
			return
		}

		// Remove all messages after the specified ts
		const updatedClaudeMessages = await this.stateManager.claudeMessagesManager.removeEverythingAfterMessage(ts)
		if (!updatedClaudeMessages) {
			vscode.window.showErrorMessage(`Failed to rollback: could not find message with ts ${ts}`)
			return
		}

		const allApiHistory = await this.stateManager.apiHistoryManager.getSavedApiConversationHistory()
		const lastApiIndex = allApiHistory.findIndex((h) => h.ts === ts)
		if (lastApiIndex !== -1) {
			const updatedApiHistory = allApiHistory.slice(0, lastApiIndex + 1)
			await this.stateManager.apiHistoryManager.overwriteApiConversationHistory(updatedApiHistory)
		}

		// Now revert all files in the task to the requested version (or nearest lower version)
		const filesMap = await this.stateManager.getFilesInTaskDirectory()
		const edit = new vscode.WorkspaceEdit()

		for (const [fPath, fVersions] of Object.entries(filesMap)) {
			// Find the version <= verNum
			const revertVersion = [...fVersions].reverse().find((fv) => fv.version <= verNum)
			if (!revertVersion) {
				// no version <= verNum means file didn't exist at that time, revert to empty
				const fileUri = vscode.Uri.file(path.resolve(this.stateManager.dirAbsolutePath ?? "", fPath))
				edit.createFile(fileUri, { overwrite: true })
			} else {
				const fileUri = vscode.Uri.file(path.resolve(this.stateManager.dirAbsolutePath ?? "", fPath))
				edit.createFile(fileUri, { overwrite: true })
				edit.insert(fileUri, new vscode.Position(0, 0), revertVersion.content)
			}
		}

		const applied = await vscode.workspace.applyEdit(edit)
		if (!applied) {
			vscode.window.showErrorMessage("Failed to apply rollback changes to files.")
			return
		}

		// Reload the webview
		await this.providerRef.deref()?.getWebviewManager().postBaseStateToWebview()
		await this.providerRef.deref()?.getWebviewManager().postClaudeMessagesToWebview(updatedClaudeMessages)

		vscode.window.showInformationMessage(`Successfully rolled back to version ${version} for ${filePath}.`)
	}

	async getEnvironmentDetails(includeFileDetails: boolean = true) {
		let details = ""
		const lastTwoMsgs = this.stateManager.state.apiConversationHistory.slice(-2)
		const awaitRequierdTools: (ToolName | "edit_file_blocks")[] = [
			"execute_command",
			"write_to_file",
			"edit_file_blocks",
			"file_editor",
		]
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
		let devServerSection = "<dev_server_status>\n"
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
					You have a total of ${logs.length} logs. Here are the last 15 logs if you want to get the full logs use the dev_server tool.\n` +
						  logs.join("\n")
				}</dev_server_logs>\n`
				devServerSection += `</dev_server_info>\n`
			}
		} else {
			devServerSection += `<dev_server_info>Dev server is not running. you can start the dev server using the dev_server tool if needed.</dev_server_info>\n`
		}
		devServerSection += `</dev_server_status>\n`
		details += devServerSection
		// It could be useful for cline to know if the user went from one or no file to another between messages, so we always include this context
		details += "<visible_files>\n"
		const visibleFiles = vscode.window.visibleTextEditors
			?.map((editor) => editor.document?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(getCwd(), absolutePath).toPosix())
			.join("\n")
		if (visibleFiles) {
			details += `${visibleFiles}`
		} else {
			details += "(No visible files)"
		}
		details += "\n</visible_files>\n"

		details += "<open_tabs>\n"
		const openTabs = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(getCwd(), absolutePath).toPosix())
			.join("\n")
		if (openTabs) {
			details += `${openTabs}`
		} else {
			details += "(No open tabs)"
		}
		details += "\n</open_tabs>\n"

		// get the diagnostics errors for all files in the current task

		const diagnosticsHandler = DiagnosticsHandler.getInstance()
		const files = this.stateManager.historyErrors ? Object.keys(this.stateManager.historyErrors) : []
		const diagnostics = await diagnosticsHandler.getDiagnostics(files)
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
			"# CURRENT ERRORS (Linter Errors) this is the only errors that are present if you seen previous linting errors they have been resolved."
		if (newErrors.length === 0) {
			details += "\n(No diagnostics errors)"
		} else {
			console.log("[ENVIRONMENT DETAILS] New errors found", newErrors.map((diag) => diag.errorString).join("\n"))
			details += `\nThe following errors are present in the current task you have been working on. this is the only errors that are present if you seen previous linting errors they have been resolved.\n`
			details += `<linter_errors>\n`
			details += newErrors.map((diag) => diag.errorString).join("\n")
			details += `</linter_errors>\n`
		}

		if (includeFileDetails) {
			console.log(`[ENVIRONMENT DETAILS] Getting file details`)
			details += `\n\n# Current Working Directory (${getCwd().toPosix()}) Files\n`
			const isDesktop = arePathsEqual(getCwd(), path.join(os.homedir(), "Desktop"))
			if (isDesktop) {
				// don't want to immediately access desktop since it would show permission popup
				details += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
			} else {
				const [files, didHitLimit] = await listFiles(getCwd(), true, 1_000)
				const result = await formatFilesList(getCwd(), files, didHitLimit)

				details += result
			}
		}

		return dedent`<environment_details>
# Here is the environment details for the current timestamp, it should be valid only for this current timestamp.
<environment_details_timestamp>${Date.now()}</environment_details_timestamp>
${details.trim()}
</environment_details>`
	}
}

export * from "./types"
