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

export class ToolExecutor {
	private runningProcessId: number | undefined
	private cwd: string
	private alwaysAllowReadOnly: boolean
	private alwaysAllowWriteOnly: boolean
	private terminalManager: TerminalManager
	private koduDev: KoduDev
	private toolQueue: BaseAgentTool[] = []
	private isProcessingTool: boolean = false
	private toolInstances: { [id: string]: BaseAgentTool } = {}
	private toolExecutionPromises: Promise<{ name: string; id: string; value: ToolResponse }>[] = []
	private toolProcessingComplete: Promise<void> | null = null
	private resolveToolProcessing: (() => void) | null = null
	private toolParser: ToolParser

	constructor(options: AgentToolOptions) {
		this.cwd = options.cwd
		this.alwaysAllowReadOnly = options.alwaysAllowReadOnly
		this.alwaysAllowWriteOnly = options.alwaysAllowWriteOnly
		this.koduDev = options.koduDev
		this.terminalManager = new TerminalManager()
		this.toolParser = new ToolParser(
			tools.map((tool) => tool.schema),
			{
				onToolUpdate: this.handleToolUpdate.bind(this),
				onToolEnd: this.handleToolEnd.bind(this),
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
		} else {
			toolInstance.updateParams(params)
			toolInstance.updateIsFinal(false)
			const inToolQueue = this.toolQueue.find((tool) => tool.id === id)
			if (inToolQueue) {
				inToolQueue.updateParams(params)
			}
		}
		// this.koduDev.taskExecutor.askWithId(
		// 	"tool",
		// 	{
		// 		tool: toolInstance.name,
		// 		status: "pending",
		// 		...params,
		// 	},
		// 	toolInstance.ts
		// )

		// if (toolName === "write_to_file") {
		// 	if (toolInstance instanceof WriteFileTool) {
		// 		await this.handlePartialWriteToFile(toolInstance)
		// 	}
		// }
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
		} else {
			toolInstance.updateParams(input)
			toolInstance.updateIsFinal(true)
		}
		this.addToolToQueue(this.toolInstances[id])
	}

	private addToolToQueue(toolInstance: BaseAgentTool): void {
		this.toolQueue.push(toolInstance)
		if (!this.isProcessingTool) {
			this.processNextTool()
		}
		if (!this.toolProcessingComplete) {
			this.toolProcessingComplete = new Promise((resolve) => {
				this.resolveToolProcessing = resolve
			})
		}
	}

	private async processNextTool(): Promise<void> {
		if (this.toolQueue.length === 0) {
			this.isProcessingTool = false
			if (this.resolveToolProcessing) {
				this.resolveToolProcessing()
				this.toolProcessingComplete = null
				this.resolveToolProcessing = null
			}
			return
		}

		this.isProcessingTool = true
		const toolInstance = this.toolQueue.shift()!

		try {
			const result = await toolInstance?.execute({
				name: toolInstance?.name as ToolName,
				input: toolInstance?.paramsInput!,
				id: toolInstance?.id!,
				ts: toolInstance?.ts!,
				isFinal: toolInstance?.isFinal!,
				isLastWriteToFile: false,
				ask: this.koduDev.taskExecutor.askWithId.bind(this.koduDev.taskExecutor),
				say: this.koduDev.taskExecutor.say.bind(this.koduDev.taskExecutor),
			})
			this.toolExecutionPromises.push(
				Promise.resolve({
					value: result,
					name: toolInstance.name,
					id: toolInstance.id,
				})
			)
		} catch (error) {
			console.error(`Error executing tool: ${toolInstance.name}`, error)
			this.toolExecutionPromises.push(
				Promise.reject({
					error,
					name: toolInstance.name,
					id: toolInstance.id,
				})
			)
		} finally {
			this.processNextTool()
		}
	}

	public async waitForToolProcessing(): Promise<void> {
		if (this.toolProcessingComplete) {
			await this.toolProcessingComplete
		}
		await Promise.allSettled(this.toolExecutionPromises)
	}

	public async getToolResults(): Promise<{ name: string; result: ToolResponse }[]> {
		const results = await Promise.allSettled(this.toolExecutionPromises)
		return results.map((result, index) => {
			if (result.status === "fulfilled") {
				return { name: result.value.name, result: result.value.value }
			} else {
				return { name: result?.reason?.name ?? "Tool", result: `Error: ${result.reason?.error}` }
			}
		})
	}

	private async handlePartialWriteToFile(tool: WriteFileTool): Promise<void> {
		const { path, content } = tool.paramsInput
		if (!path || !content) {
			// wait for both path and content to be available
			return
		}
		// check if current tool is write to file (in queue) if so, update the content, otherwise skip it.
		const inToolQueue = this.toolQueue.findIndex((tool) => tool.id === tool.id)
		// if (inToolQueue === 0) {
		// 	await tool.handlePartialContent(path, content)
		// }
	}

	public resetToolState(): void {
		this.toolQueue = []
		this.isProcessingTool = false
		this.toolInstances = {}
		this.toolExecutionPromises = []
		this.toolProcessingComplete = null
		this.resolveToolProcessing = null
	}
}
