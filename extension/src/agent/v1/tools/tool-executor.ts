import treeKill from "tree-kill"
import { ToolName, ToolResponse } from "../types"
import { KoduDev } from ".."
import { AgentToolOptions, AgentToolParams } from "./types"
import {
	SearchFilesTool,
	ListFilesTool,
	ListCodeDefinitionNamesTool,
	ExecuteCommandTool,
	AttemptCompletionTool,
	AskFollowupQuestionTool,
	ReadFileTool,
	WriteFileTool,
	UrlScreenshotTool,
	AskConsultantTool,
	UpsertTaskHistoryTool,
} from "."
import { WebSearchTool } from "./runners/web-search-tool"
import { TerminalManager } from "../../../integrations/terminal/terminal-manager"
import { BaseAgentTool } from "./base-agent.tool"
import ToolParser from "./tool-parser/tool-parser"
import { tools } from "./schema"
import pWaitFor from "p-wait-for"
import PQueue from "p-queue"
import { ChatTool } from "../../../shared/new-tools"

export class ToolExecutor {
	private runningProcessId: number | undefined
	private cwd: string
	private alwaysAllowReadOnly: boolean
	private alwaysAllowWriteOnly: boolean
	private terminalManager: TerminalManager
	private koduDev: KoduDev
	private toolQueue: BaseAgentTool[] = []
	private toolInstances: { [id: string]: BaseAgentTool } = {}
	private toolParser: ToolParser
	private toolResults: { name: string; result: ToolResponse }[] = []
	private isProcessing: Promise<void> | null = null
	private queue: PQueue

	constructor(options: AgentToolOptions) {
		this.cwd = options.cwd
		this.alwaysAllowReadOnly = options.alwaysAllowReadOnly
		this.alwaysAllowWriteOnly = options.alwaysAllowWriteOnly
		this.koduDev = options.koduDev
		this.queue = new PQueue({ concurrency: 1 })
		this.terminalManager = new TerminalManager()
		this.toolParser = new ToolParser(
			tools.map((tool) => tool.schema),
			{
				onToolUpdate: this.handleToolUpdate.bind(this),
				onToolEnd: this.handleToolEnd.bind(this),
				onToolError: (id, toolName, error, ts) => {
					console.error(`Error processing tool: ${id}`, error)
					this.koduDev.taskExecutor.askWithId(
						"tool",
						{
							// @ts-expect-error - missing body
							tool: {
								tool: toolName as ChatTool["tool"],
								ts,
								approvalState: "error",
								error: error.message,
							},
						},
						ts
					)
				},
			}
		)
	}

	public get options(): AgentToolOptions {
		return {
			cwd: this.cwd,
			alwaysAllowReadOnly: this.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: this.alwaysAllowWriteOnly,
			koduDev: this.koduDev,
			setRunningProcessId: this.setRunningProcessId,
		}
	}

	async executeTool(params: AgentToolParams): Promise<ToolResponse> {
		const tool = this.getTool(params)
		return tool.execute({
			name: tool?.name as ToolName,
			input: tool?.paramsInput,
			id: tool?.id,
			ts: tool?.ts,
			isFinal: tool?.isFinal,
			isLastWriteToFile: false,
			ask: this.koduDev.taskExecutor.askWithId.bind(this),
			say: this.koduDev.taskExecutor.say.bind(this),
		})
	}

	public getTool(params: AgentToolParams): BaseAgentTool {
		switch (params.name) {
			case "read_file":
				return new ReadFileTool(params, this.options)
			case "list_files":
				return new ListFilesTool(params, this.options)
			case "search_files":
				return new SearchFilesTool(params, this.options)
			case "write_to_file":
				return new WriteFileTool(params, this.options)
			case "list_code_definition_names":
				return new ListCodeDefinitionNamesTool(params, this.options)
			case "execute_command":
				return new ExecuteCommandTool(params, this.options)
			case "ask_followup_question":
				return new AskFollowupQuestionTool(params, this.options)
			case "attempt_completion":
				return new AttemptCompletionTool(params, this.options)
			case "web_search":
				return new WebSearchTool(params, this.options)
			case "url_screenshot":
				return new UrlScreenshotTool(params, this.options)
			case "ask_consultant":
				return new AskConsultantTool(params, this.options)
			case "upsert_memory":
				return new UpsertTaskHistoryTool(params, this.options)
			default:
				throw new Error(`Unknown tool: ${params.name}`)
		}
	}

	setAlwaysAllowReadOnly(value: boolean) {
		this.alwaysAllowReadOnly = value
	}

	setAlwaysAllowWriteOnly(value: boolean) {
		this.alwaysAllowWriteOnly = value
	}

	setRunningProcessId(pid: number | undefined) {
		this.runningProcessId = pid
	}

	abortTask() {
		const runningProcessId = this.runningProcessId
		if (runningProcessId) {
			treeKill(runningProcessId, "SIGTERM")
		}
	}

	/**
	 *
	 * @param text - text to process
	 * @returns the non-xml text
	 */
	public async processToolUse(text: string): Promise<string> {
		return await this.toolParser.appendText(text)
	}

	private async handleToolUpdate(id: string, toolName: string, params: any, ts: number): Promise<void> {
		let toolInstance = this.toolInstances[id]
		if (!toolInstance) {
			const newTool = this.getTool({
				name: toolName as ToolName,
				input: params,
				id: id,
				ts: ts,
				isFinal: false,
				isLastWriteToFile: false,
				ask: this.koduDev.taskExecutor.askWithId.bind(this.koduDev.taskExecutor),
				say: this.koduDev.taskExecutor.say.bind(this.koduDev.taskExecutor),
			})
			this.toolInstances[id] = newTool
			toolInstance = newTool
			this.toolQueue.push(newTool)
		} else {
			toolInstance.updateParams(params)
			toolInstance.updateIsFinal(false)
		}
		// if the tool is the first in the queue, we should update his askContent
		if (this.toolQueue[0].id === id) {
			if (toolInstance.toolParams.name === "write_to_file") {
				if (!(toolInstance as WriteFileTool).diffViewProvider.isEditing) {
					this.koduDev.taskExecutor.askWithId(
						"tool",
						{
							tool: {
								tool: toolInstance.name,
								...params,
								ts,
								approvalState: "loading",
							},
						},
						ts
					)
				}
				this.handlePartialWriteToFile(toolInstance as WriteFileTool)
				// skip updating the tool if the diff view is in editing mode
				return
			}
			this.koduDev.taskExecutor.askWithId(
				"tool",
				{
					tool: {
						tool: toolInstance.name,
						...params,
						ts,
						approvalState: "loading",
					},
				},
				ts
			)
		}
	}

	private async handleToolEnd(id: string, toolName: string, input: any): Promise<void> {
		let toolInstance = this.toolInstances[id]
		if (!toolInstance) {
			const newTool = this.getTool({
				name: toolName as ToolName,
				input: input,
				id: id,
				ts: Date.now(),
				isFinal: true,
				isLastWriteToFile: false,
				ask: this.koduDev.taskExecutor.askWithId.bind(this.koduDev.taskExecutor),
				say: this.koduDev.taskExecutor.say.bind(this.koduDev.taskExecutor),
			})
			this.toolInstances[id] = newTool
			this.toolQueue.push(newTool)
		} else {
			toolInstance.updateParams(input)
			toolInstance.updateIsFinal(true)
		}

		// Add the tool to the queue for processing
		this.queue.add(() => this.processTool(toolInstance))

		if (this.toolQueue[0]?.id === id) {
			this.koduDev.taskExecutor.askWithId(
				"tool",
				{
					tool: {
						tool: toolInstance.name,
						...input,
						ts: toolInstance.ts,
						approvalState: "loading",
					},
				},
				toolInstance.ts
			)
		}
	}

	public getToolResults(): { name: string; result: ToolResponse }[] {
		return this.toolResults
	}

	private async processTool(tool: BaseAgentTool): Promise<void> {
		// Ensure tool is final before execution
		await pWaitFor(() => tool.isFinal, { interval: 50 })

		try {
			const result = await tool.execute({
				name: tool.name as ToolName,
				input: tool.paramsInput,
				id: tool.id,
				ts: tool.ts,
				isFinal: true,
				isLastWriteToFile: false,
				ask: this.options.koduDev.taskExecutor.askWithId.bind(this.options.koduDev.taskExecutor),
				say: this.options.koduDev.taskExecutor.say.bind(this.options.koduDev.taskExecutor),
			})

			this.toolResults.push({ name: tool.name, result })
		} catch (error) {
			console.error(`Error executing tool: ${tool.name}`, error)
			this.toolResults.push({ name: tool.name, result: `Error: ${error}` })
		}

		// Remove the tool from the toolQueue
		this.toolQueue = this.toolQueue.filter((t) => t.id !== tool.id)
	}

	public async waitForToolProcessing(): Promise<void> {
		// Wait until the queue is empty
		await this.queue.onIdle()
	}

	private async handlePartialWriteToFile(tool: WriteFileTool): Promise<void> {
		const { path, content } = tool.paramsInput
		if (!path || !content) {
			// wait for both path and content to be available
			return
		}
		// check if current tool is write to file (in queue) if so, update the content, otherwise skip it.
		const inToolQueue = this.toolQueue.findIndex((t) => t.id === tool.id)
		if (inToolQueue === 0) {
			await tool.handlePartialContent(path, content)
		}
	}

	public resetToolState(): void {
		for (const tool of this.toolQueue) {
			tool.abortToolExecution()
		}
		this.toolQueue = []
		this.isProcessing = null
		this.toolInstances = {}
		this.toolResults = []
	}
}
