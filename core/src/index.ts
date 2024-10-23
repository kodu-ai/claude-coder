import os from "os"
import vscode from "vscode"
import path from "path"
import { Anthropic } from "@anthropic-ai/sdk"
import { ToolExecutor } from "@/ai"
import {
	KoduDevOptions,
	ToolResponse,
	UserContent,
	TaskState,
	ChatTool,
	ClaudeAsk,
	AskResponse,
	ClaudeAskResponse,
	ToolName,
	ToolInput,
} from "@/types"
import {
	getCwd,
	formatImagesIntoBlocks,
	getPotentiallyRelevantDetails,
	formatFilesList,
	listFiles,
	isV1ClaudeMessage,
	arePathsEqual,
	findLastIndex,
	amplitudeTracker,
} from "@/utils"
import { BrowserService, TaskExecutor, DiagnosticsService } from "@/services"
import { AdvancedTerminalManager, TerminalRegistry } from "@/integrations"

import { koduApiService, stateService, StateService } from "./singletons"

// new KoduDev
export class KoduDev {
	public toolExecutor: ToolExecutor
	public taskExecutor: TaskExecutor
	/**
	 * If the last api message caused a file edit
	 */
	public isLastMessageFileEdit: boolean = false
	public terminalManager: AdvancedTerminalManager
	private pendingAskResponse: ((value: AskResponse) => void) | null = null
	public browserManager: BrowserService
	public isFirstMessage: boolean = true

	constructor(options: KoduDevOptions) {
		const { apiConfiguration, customInstructions, task, images, historyItem, globalStoragePath } = options
		stateService.initialize(options)
		koduApiService.initialize(apiConfiguration, customInstructions)

		this.toolExecutor = new ToolExecutor({
			cwd: getCwd(),
			alwaysAllowReadOnly: stateService.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: stateService.alwaysAllowWriteOnly,
			koduDev: this,
		})
		this.terminalManager = new AdvancedTerminalManager()
		this.taskExecutor = new TaskExecutor(this.toolExecutor)
		this.browserManager = new BrowserService(globalStoragePath!)

		this.setupTaskExecutor()

		stateService.setState({
			taskId: historyItem ? historyItem.id : Date.now().toString(),
			dirAbsolutePath: historyItem?.dirAbsolutePath ?? "",
			isRepoInitialized: historyItem?.isRepoInitialized ?? false,
			requestCount: 0,
			apiConversationHistory: [],
			claudeMessages: [],
			abort: false,
		})

		if (historyItem?.dirAbsolutePath) {
		}

		if (historyItem) {
			stateService.state.isHistoryItem = true
			this.resumeTaskFromHistory()
		} else if (task || images) {
			this.startTask(task, images)
		} else {
			throw new Error("Either historyItem or task/images must be provided")
		}
	}

	private setupTaskExecutor() {
		// Pass necessary methods to the TaskExecutor
		this.taskExecutor = new TaskExecutor(this.toolExecutor)
	}

	async handleWebviewAskResponse(askResponse: ClaudeAskResponse, text?: string, images?: string[]) {
		console.log(`Is there a pending ask response? ${!!this.pendingAskResponse}`)
		if (this.taskExecutor.state === TaskState.ABORTED && (text || images)) {
			let textBlock: Anthropic.TextBlockParam = {
				type: "text",
				text: text ?? "",
			}
			let imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
			console.log(`current api history: ${JSON.stringify(stateService.state.apiConversationHistory)}`)
			await this.taskExecutor.newMessage([textBlock, ...imageBlocks])
			return
		}
		if (this.pendingAskResponse) {
			this.pendingAskResponse({ response: askResponse, text, images })
			this.pendingAskResponse = null
		} else if (stateService.state.isHistoryItemResumed) {
			// this is a bug
		}
		if (
			(this.taskExecutor.state === TaskState.WAITING_FOR_USER || this.taskExecutor.state === TaskState.IDLE) &&
			askResponse === "messageResponse" &&
			!this.pendingAskResponse
		) {
			await this.taskExecutor.newMessage([
				{
					type: "text",
					text: text ?? "",
				},
				...formatImagesIntoBlocks(images),
			])
			return
		}
		this.taskExecutor.handleAskResponse(askResponse, text, images)
	}
	private async startTask(task?: string, images?: string[]): Promise<void> {
		stateService.state.claudeMessages = []
		stateService.state.apiConversationHistory = []
		// TODO: refactor
		// await this.providerRef.deref()?.getWebviewManager().postStateToWebview()

		let textBlock: Anthropic.TextBlockParam = {
			type: "text",
			text: `<task>\n${task}\n</task>\n\n${getPotentiallyRelevantDetails()}`,
		}
		let imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
		amplitudeTracker.taskStart(stateService.state.taskId)

		await this.taskExecutor.say("text", task, images)
		await this.taskExecutor.startTask([textBlock, ...imageBlocks])
	}

	/**
	 * @todo bug fix - sometlogic is not working properly with cancelled tasks or errored tasks
	 */
	async resumeTaskFromHistory() {
		const modifiedClaudeMessages = await stateService.getSavedClaudeMessages()

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
				if (m.say === "api_req_started" && m.isFetching) {
					isFetchingInturrupted = true
					m.isFetching = false
					m.isDone = true
					m.isError = true
					m.errorText = "Task was interrupted before this API request could be completed."
				}
				if (m.ask === "tool" && m.type === "ask") {
					const parsedTool = JSON.parse(m.text ?? "{}") as ChatTool | string
					if (
						typeof parsedTool === "object" &&
						(parsedTool.approvalState === "pending" ||
							parsedTool.approvalState === undefined ||
							parsedTool.approvalState === "loading")
					) {
						const toolsToSkip: ChatTool["tool"][] = ["ask_followup_question"]
						if (toolsToSkip.includes(parsedTool.tool)) {
							parsedTool.approvalState = "pending"
							m.text = JSON.stringify(parsedTool)
							return
						}
						parsedTool.approvalState = "rejected"
						parsedTool.error = "Task was interrupted before this tool call could be completed."
						m.text = JSON.stringify(parsedTool)
					}
				}
			}
		})
		await stateService.overwriteClaudeMessages(modifiedClaudeMessages)
		stateService.state.claudeMessages = await stateService.getSavedClaudeMessages()

		const lastClaudeMessage = stateService.state.claudeMessages
			.slice()
			.reverse()
			.find((m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"))

		let askType: ClaudeAsk = lastClaudeMessage?.ask === "completion_result" ? "resume_completed_task" : "resume_task"

		const { response, text, images } = await this.taskExecutor.ask(askType)

		let newUserContent: UserContent = []
		if (response === "messageResponse") {
			await this.taskExecutor.say("user_feedback", text, images)
			if (images && images.length > 0) {
				newUserContent.push(...formatImagesIntoBlocks(images))
			}
			if (text) {
				newUserContent.push({ type: "text", text })
			}
		}

		const existingApiConversationHistory: Anthropic.Messages.MessageParam[] =
			await stateService.getSavedApiConversationHistory()

		let modifiedOldUserContent: UserContent
		let modifiedApiConversationHistory: Anthropic.Messages.MessageParam[]
		if (existingApiConversationHistory.length > 0) {
			const lastMessage = existingApiConversationHistory[existingApiConversationHistory.length - 1]

			if (lastMessage.role === "assistant") {
				const content = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				const hasToolUse = content.some((block) => block.type === "tool_use")

				if (hasToolUse) {
					const toolUseBlocks = content.filter(
						(block) => block.type === "tool_use"
					) as Anthropic.Messages.ToolUseBlock[]
					const toolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => ({
						type: "tool_result",
						tool_use_id: block.id,
						content: "Task was interrupted before this tool call could be completed.",
					}))
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = [...toolResponses]
				} else {
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = []
				}
			} else if (lastMessage.role === "user") {
				const previousAssistantMessage = existingApiConversationHistory[existingApiConversationHistory.length - 2]

				const existingUserContent: UserContent = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				if (previousAssistantMessage && previousAssistantMessage.role === "assistant") {
					const assistantContent = Array.isArray(previousAssistantMessage.content)
						? previousAssistantMessage.content
						: [{ type: "text", text: previousAssistantMessage.content }]

					const toolUseBlocks = assistantContent.filter(
						(block) => block.type === "tool_use"
					) as Anthropic.Messages.ToolUseBlock[]

					if (toolUseBlocks.length > 0) {
						const existingToolResults = existingUserContent.filter(
							(block) => block.type === "tool_result"
						) as Anthropic.ToolResultBlockParam[]

						const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
							.filter((toolUse) => !existingToolResults.some((result) => result.tool_use_id === toolUse.id))
							.map((toolUse) => ({
								type: "tool_result",
								tool_use_id: toolUse.id,
								content: "Task was interrupted before this tool call could be completed.",
							}))

						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent, ...missingToolResponses]
					} else {
						modifiedApiConversationHistory = [...existingApiConversationHistory]
						modifiedOldUserContent = [...existingUserContent]
					}
				} else {
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = [...existingUserContent]
				}
			} else {
				throw new Error("Unexpected: Last message is not a user or assistant message")
			}
		} else {
			throw new Error("Unexpected: No existing API conversation history")
		}

		const modifiedOldUserContentText = modifiedOldUserContent.find((block) => block.type === "text")?.text
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
			(modifiedOldUserContentText
				? `\n\nLast recorded user input before interruption:\n<previous_message>\n${modifiedOldUserContentText}\n</previous_message>\n`
				: "") +
			(newUserContentText
				? `\n\nNew instructions for task continuation:\n<user_message>\n${newUserContentText}\n</user_message>\n`
				: "")
		combinedText += `\n\n`
		combinedText += await this.getEnvironmentDetails(true)
		combinedText += `No dev server information is available. Please start the dev server if needed.`

		const newUserContentImages = newUserContent.filter((block) => block.type === "image")
		const combinedModifiedOldUserContentWithNewUserContent: UserContent = (
			modifiedOldUserContent.filter((block) => block.type !== "text") as UserContent
		).concat([{ type: "text", text: combinedText }, ...newUserContentImages])

		const pastRequestsCount = modifiedApiConversationHistory.filter((m) => m.role === "assistant").length
		amplitudeTracker.taskResume(stateService.state.taskId, pastRequestsCount)

		stateService.state.isHistoryItemResumed = true
		await stateService.overwriteApiConversationHistory(modifiedApiConversationHistory)
		await this.taskExecutor.startTask(combinedModifiedOldUserContentWithNewUserContent)
	}

	async abortTask() {
		await this.taskExecutor.abortTask()
		this.browserManager.closeBrowser()
		this.terminalManager.disposeAll()
		TerminalRegistry.clearAllDevServers()
	}

	async executeTool(name: ToolName, input: ToolInput, isLastWriteToFile: boolean = false): Promise<ToolResponse> {
		const now = Date.now()
		return this.toolExecutor.executeTool({
			name,
			input,
			id: now.toString(),
			ts: now,
			isLastWriteToFile,
			ask: this.taskExecutor.ask.bind(this.taskExecutor),
			say: this.taskExecutor.say.bind(this.taskExecutor),
			updateAsk: this.taskExecutor.updateAsk.bind(this.taskExecutor),
		})
		4
	}

	async getEnvironmentDetails(includeFileDetails: boolean = true) {
		let details = ""
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
				const serverName = server.terminalInfo.name
				devServerSection += `<dev_server_info>\n`
				devServerSection += `<server_name>${serverName}</server_name>\n`
				devServerSection += `<dev_server_url>${server.url}</dev_server_url>\n`
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

		const diagnosticsHandler = DiagnosticsService.getInstance()
		const files = stateService.historyErrors ? Object.keys(stateService.historyErrors) : []
		const diagnostics = diagnosticsHandler.getDiagnostics(files)
		const newErrors = diagnostics.filter((diag) => diag.errorString !== null)
		const taskErrorsRecord = newErrors.reduce((acc, curr) => {
			acc[curr.key] = {
				lastCheckedAt: Date.now(),
				error: curr.errorString!,
			}
			return acc
		}, {} as NonNullable<typeof stateService.historyErrors>)
		stateService.historyErrors = taskErrorsRecord

		// map the diagnostics to the original file path
		details += "\n\n# CURRENT ERRORS (Linter Errors)"
		if (newErrors.length === 0) {
			details += "\n(No diagnostics errors)"
		} else {
			details +=
				"\n (Errors found in the following files) please address these errors before proceeding with the task, this action is critical to the task completion."
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
				const [files, didHitLimit] = await listFiles(getCwd(), true, 200)
				const result = formatFilesList(getCwd(), files, didHitLimit)

				details += result
			}
		}

		return `<environment_details>\n${details.trim()}\n</environment_details>`
	}
}

export * from "./types"
