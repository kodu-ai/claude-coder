import { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeDevProvider } from "../../providers/claude-dev/ClaudeDevProvider"
import { ClaudeAsk, ClaudeSay } from "../../shared/ExtensionMessage"
import { ToolName } from "../../shared/Tool"
import { ClaudeAskResponse } from "../../shared/WebviewMessage"
import { ApiManager } from "./api-handler"
import { ToolExecutor } from "./tool-executor"
import { KoduDevOptions, ToolResponse, UserContent } from "./types"
import { getCwd, formatImagesIntoBlocks, getPotentiallyRelevantDetails, cwd, formatFilesList } from "./utils"
import { StateManager } from "./state-manager"
import { AskResponse, TaskExecutor, TaskState } from "./task-executor"
import { findLastIndex } from "../../utils"
import { amplitudeTracker } from "../../utils/amplitude"
import { ToolInput } from "./tools/types"
import DiagnosticsMonitor from "../../integrations/diagnostics-monitor"
import * as vscode from "vscode"
import path from "path"
import pWaitFor from "p-wait-for"
import delay from "delay"
import { homedir } from "os"
import { listFiles } from "../../parse-source-code"
import { TerminalManager } from "../../integrations/terminal-manager"

// new KoduDev
export class KoduDev {
	private stateManager: StateManager
	private apiManager: ApiManager
	private toolExecutor: ToolExecutor
	private diagnosticsMonitor: DiagnosticsMonitor
	public taskExecutor: TaskExecutor
	private providerRef: WeakRef<ClaudeDevProvider>
	public terminalManager: TerminalManager
	public didEditFile: boolean = false

	private pendingAskResponse: ((value: AskResponse) => void) | null = null

	constructor(options: KoduDevOptions) {
		const { provider, apiConfiguration, customInstructions, task, images, historyItem } = options
		this.stateManager = new StateManager(options)
		this.providerRef = new WeakRef(provider)
		this.terminalManager = new TerminalManager()
		this.apiManager = new ApiManager(provider, apiConfiguration, customInstructions)
		this.diagnosticsMonitor = new DiagnosticsMonitor()
		this.toolExecutor = new ToolExecutor({
			cwd: getCwd(),
			alwaysAllowReadOnly: this.stateManager.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: this.stateManager.alwaysAllowWriteOnly,
			koduDev: this,
		})
		this.taskExecutor = new TaskExecutor(this.stateManager, this.toolExecutor, this)

		this.setupTaskExecutor()

		this.stateManager.setState({
			taskId: historyItem ? historyItem.id : Date.now().toString(),
			requestCount: 0,
			apiConversationHistory: [],
			claudeMessages: [],
			abort: false,
		})

		if (historyItem) {
			this.stateManager.state.isHistoryItem = true
			this.resumeTaskFromHistory()
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
		this.taskExecutor = new TaskExecutor(this.stateManager, this.toolExecutor, this)
	}

	async handleWebviewAskResponse(askResponse: ClaudeAskResponse, text?: string, images?: string[]) {
		console.log(`Is there a pending ask response? ${!!this.pendingAskResponse}`)
		if (this.taskExecutor.state === TaskState.ABORTED && (text || images)) {
			let textBlock: Anthropic.TextBlockParam = {
				type: "text",
				text: text ?? "",
			}
			let imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
			console.log(`current api history: ${JSON.stringify(this.stateManager.state.apiConversationHistory)}`)
			await this.taskExecutor.newMessage([textBlock, ...imageBlocks])
			return
		}
		if (this.pendingAskResponse) {
			this.pendingAskResponse({ response: askResponse, text, images })
			this.pendingAskResponse = null
		} else if (this.stateManager.state.isHistoryItemResumed) {
			// this is a bug
		}
		this.taskExecutor.handleAskResponse(askResponse, text, images)
	}
	private async startTask(task?: string, images?: string[]): Promise<void> {
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

	/**
	 * @todo bug fix - sometlogic is not working properly with cancelled tasks or errored tasks
	 */
	async resumeTaskFromHistory() {
		const modifiedClaudeMessages = await this.stateManager.getSavedClaudeMessages()

		const lastRelevantMessageIndex = findLastIndex(
			modifiedClaudeMessages,
			(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")
		)
		if (lastRelevantMessageIndex !== -1) {
			modifiedClaudeMessages.splice(lastRelevantMessageIndex + 1)
		}

		await this.stateManager.overwriteClaudeMessages(modifiedClaudeMessages)
		this.stateManager.state.claudeMessages = await this.stateManager.getSavedClaudeMessages()

		const lastClaudeMessage = this.stateManager.state.claudeMessages
			.slice()
			.reverse()
			.find((m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"))

		let askType: ClaudeAsk =
			lastClaudeMessage?.ask === "completion_result" ? "resume_completed_task" : "resume_task"

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
			await this.stateManager.getSavedApiConversationHistory()

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
				const previousAssistantMessage =
					existingApiConversationHistory[existingApiConversationHistory.length - 2]

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
							.filter(
								(toolUse) => !existingToolResults.some((result) => result.tool_use_id === toolUse.id)
							)
							.map((toolUse) => ({
								type: "tool_result",
								tool_use_id: toolUse.id,
								content: "Task was interrupted before this tool call could be completed.",
							}))

						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent, ...missingToolResponses]
					} else {
						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent]
					}
				} else {
					modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
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

		const combinedText =
			`Task resumption: This autonomous coding task was interrupted ${agoText}. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. The current working directory is now ${getCwd()}. If the task has not been completed, retry the last step before interruption and proceed with completing the task.` +
			(modifiedOldUserContentText
				? `\n\nLast recorded user input before interruption:\n<previous_message>\n${modifiedOldUserContentText}\n</previous_message>\n`
				: "") +
			(newUserContentText
				? `\n\nNew instructions for task continuation:\n<user_message>\n${newUserContentText}\n</user_message>\n`
				: "") +
			`\n\n${getPotentiallyRelevantDetails()}`

		const newUserContentImages = newUserContent.filter((block) => block.type === "image")
		const combinedModifiedOldUserContentWithNewUserContent: UserContent = (
			modifiedOldUserContent.filter((block) => block.type !== "text") as UserContent
		).concat([{ type: "text", text: combinedText }, ...newUserContentImages])

		this.stateManager.state.isHistoryItemResumed = true
		await this.stateManager.overwriteApiConversationHistory(modifiedApiConversationHistory)
		await this.taskExecutor.startTask(combinedModifiedOldUserContentWithNewUserContent)
	}

	async abortTask() {
		this.taskExecutor.abortTask()
		this.toolExecutor.abortTask()
		this.diagnosticsMonitor.dispose()
	}

	async getEnvironmentDetails(includeFileDetails: boolean = false) {
		let details = ""

		// It could be useful for claude to know if the user went from one or no file to another between messages, so we always include this context
		details += "\n\n# VSCode Visible Files"
		const visibleFiles = vscode.window.visibleTextEditors
			?.map((editor) => editor.document?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(cwd, absolutePath))
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
			.map((absolutePath) => path.relative(cwd, absolutePath))
			.join("\n")
		if (openTabs) {
			details += `\n${openTabs}`
		} else {
			details += "\n(No open tabs)"
		}

		const busyTerminals = this.terminalManager.getTerminals(true)
		const inactiveTerminals = this.terminalManager.getTerminals(false)
		const allTerminals = [...busyTerminals, ...inactiveTerminals]

		if (busyTerminals.length > 0 || this.didEditFile) {
			await delay(300) // delay after saving file to let terminals/diagnostics catch up
		}

		let terminalWasBusy = false
		if (allTerminals.length > 0) {
			// wait for terminals to cool down
			// note this does not mean they're actively running just that they recently output something
			terminalWasBusy = allTerminals.some((t) => this.terminalManager.isProcessHot(t.id))
			await pWaitFor(() => allTerminals.every((t) => !this.terminalManager.isProcessHot(t.id)), {
				interval: 100,
				timeout: 15_000,
			}).catch(() => {})
		}

		// we want to get diagnostics AFTER terminal cools down for a few reasons: terminal could be scaffolding a project, dev servers (compilers like webpack) will first re-compile and then send diagnostics, etc
		let diagnosticsDetails = ""
		const diagnostics = await this.diagnosticsMonitor.getCurrentDiagnostics(this.didEditFile || terminalWasBusy) // if claude ran a command (ie npm install) or edited the workspace then wait a bit for updated diagnostics
		for (const [uri, fileDiagnostics] of diagnostics) {
			const problems = fileDiagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error)
			if (problems.length > 0) {
				diagnosticsDetails += `\n## ${path.relative(cwd, uri.fsPath)}`
				for (const diagnostic of problems) {
					// let severity = diagnostic.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning"
					const line = diagnostic.range.start.line + 1 // VSCode lines are 0-indexed
					const source = diagnostic.source ? `[${diagnostic.source}] ` : ""
					diagnosticsDetails += `\n- ${source}Line ${line}: ${diagnostic.message}`
				}
			}
		}
		this.didEditFile = false // reset, this lets us know when to wait for saved files to update diagnostics

		// waiting for updated diagnostics lets terminal output be the most up-to-date possible
		let terminalDetails = ""
		if (busyTerminals.length > 0) {
			// terminals are cool, let's retrieve their output
			terminalDetails += "\n\n# Active Terminals"
			for (const busyTerminal of busyTerminals) {
				terminalDetails += `\n## ${busyTerminal.lastCommand}`
				const newOutput = this.terminalManager.getUnretrievedOutput(busyTerminal.id)
				if (newOutput) {
					terminalDetails += `\n### New Output\n${newOutput}`
				} else {
					// details += `\n(Still running, no new output)` // don't want to show this right after running the command
				}
			}
		}
		// only show inactive terminals if there's output to show
		if (inactiveTerminals.length > 0) {
			const inactiveTerminalOutputs = new Map<number, string>()
			for (const inactiveTerminal of inactiveTerminals) {
				const newOutput = this.terminalManager.getUnretrievedOutput(inactiveTerminal.id)
				if (newOutput) {
					inactiveTerminalOutputs.set(inactiveTerminal.id, newOutput)
				}
			}
			if (inactiveTerminalOutputs.size > 0) {
				terminalDetails += "\n\n# Inactive Terminals"
				for (const [terminalId, newOutput] of inactiveTerminalOutputs) {
					const inactiveTerminal = inactiveTerminals.find((t) => t.id === terminalId)
					if (inactiveTerminal) {
						terminalDetails += `\n## ${inactiveTerminal.lastCommand}`
						terminalDetails += `\n### New Output\n${newOutput}`
					}
				}
			}
		}

		details += "\n\n# VSCode Workspace Errors"
		if (diagnosticsDetails) {
			details += diagnosticsDetails
		} else {
			details += "\n(No errors detected)"
		}

		if (terminalDetails) {
			details += terminalDetails
		}

		if (includeFileDetails) {
			const isDesktop = cwd === path.join(homedir(), "Desktop")
			const files = await listFiles(cwd, !isDesktop)
			const result = formatFilesList(cwd, files)
			details += `\n\n# Current Working Directory (${cwd}) Files\n${result}${
				isDesktop
					? "\n(Note: Only top-level contents shown for Desktop by default. Use list_files to explore further if necessary.)"
					: ""
			}`
		}

		return `<environment_details>\n${details.trim()}\n</environment_details>`
	}

	async executeTool(name: ToolName, input: ToolInput, isLastWriteToFile: boolean = false): Promise<ToolResponse> {
		return this.toolExecutor.executeTool({
			name,
			input,
			isLastWriteToFile,
			ask: this.taskExecutor.ask.bind(this.taskExecutor),
			say: this.taskExecutor.say.bind(this.taskExecutor),
		})
	}
}

export * from "./types"
