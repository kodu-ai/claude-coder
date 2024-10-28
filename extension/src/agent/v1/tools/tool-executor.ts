import treeKill from "tree-kill"
import { ToolName, ToolResponse, UserContent } from "../types"
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
import { DevServerTool } from "./runners/dev-server.tool"
import Anthropic from "@anthropic-ai/sdk"

export class ToolExecutor {
	private runningProcessId: number | undefined
	private cwd: string
	private alwaysAllowReadOnly: boolean
	private alwaysAllowWriteOnly: boolean
	private koduDev: KoduDev
	private toolQueue: BaseAgentTool[] = []
	private toolInstances: { [id: string]: BaseAgentTool } = {}
	private toolParser: ToolParser
	private toolResults: { name: string; result: ToolResponse }[] = []
	private queue: PQueue
	private isAborting: boolean = false
	private abortTimeoutMs: number = 2000 // 2 second timeout for cleanup

	constructor(options: AgentToolOptions) {
		this.cwd = options.cwd
		this.alwaysAllowReadOnly = options.alwaysAllowReadOnly
		this.alwaysAllowWriteOnly = options.alwaysAllowWriteOnly
		this.koduDev = options.koduDev
		this.queue = new PQueue({ concurrency: 1 })
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

	public hasActiveTools(): boolean {
		return this.toolQueue.length > 0 || this.queue.size > 0
	}

	async executeTool(params: AgentToolParams): Promise<ToolResponse> {
		if (this.isAborting) {
			throw new Error("Cannot execute tool while aborting")
		}
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
			updateAsk: this.koduDev.taskExecutor.updateAsk.bind(this.options.koduDev.taskExecutor),
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
			case "server_runner_tool":
				return new DevServerTool(params, this.options)
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

	async abortTask(): Promise<void> {
		if (this.isAborting) {
			return
		}

		this.isAborting = true
		try {
			// Clear the queue first
			this.queue.clear()

			// Reset the tool parser
			this.toolParser.reset()

			// Create a promise that resolves after timeout
			const timeoutPromise = new Promise<void>((_, reject) => {
				setTimeout(() => reject(new Error("Cleanup timeout")), this.abortTimeoutMs)
			})

			// Kill running process if exists
			const cleanupPromise = new Promise<void>(async (resolve) => {
				const runningProcessId = this.runningProcessId
				if (runningProcessId) {
					await new Promise<void>((resolve) => {
						treeKill(runningProcessId, "SIGTERM", (err) => {
							if (err) {
								console.error("Error killing process:", err)
							}
							this.runningProcessId = undefined
							resolve()
						})
					})
				}

				// Cancel all running tools
				const cancelPromises = this.toolQueue.map((tool) => tool.abortToolExecution())
				await Promise.allSettled(
					cancelPromises.map((promise) =>
						promise.catch((error) => {
							console.error("Error cancelling tool execution", error)
						})
					)
				)

				// Wait for queue to be empty
				await this.queue.onIdle()

				// Reset all state
				this.toolQueue = []
				this.toolInstances = {}
				this.toolResults = []
				resolve()
			})

			// Race between cleanup and timeout
			await Promise.race([cleanupPromise, timeoutPromise])
		} catch (error) {
			console.error("Cleanup error or timeout:", error)
		} finally {
			this.isAborting = false
		}
	}

	/**
	 *
	 * @param text - text to process
	 * @returns the non-xml text
	 */
	public async processToolUse(text: string): Promise<string> {
		if (this.isAborting) {
			return text
		}
		return await this.toolParser.appendText(text)
	}

	private async handleToolUpdate(id: string, toolName: string, params: any, ts: number): Promise<void> {
		if (this.isAborting) {
			return
		}

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
				updateAsk: this.koduDev.taskExecutor.updateAsk.bind(this.options.koduDev.taskExecutor),
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
		if (this.isAborting) {
			console.log(`Tool is aborting, skipping tool: ${toolName} input: ${input}`)
			return
		}

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
				updateAsk: this.koduDev.taskExecutor.updateAsk.bind(this.options.koduDev.taskExecutor),
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

	/**
	 * Get the text block for the tool results in order and with the correct formatting
	 */
	public getToolsResultBlock(): UserContent {
		let blocks: UserContent = []
		const results = this.getToolResults()
		blocks = results.flatMap((result) => {
			if (typeof result.result === "string") {
				const block: UserContent = [
					{
						text: `<tool_result>
					<tool_name>${result.name}</tool_name>
					<tool_output>${result.result}</tool_output>
					</tool_result>`,
						type: "text",
					},
				]
				return block
			}
			if (Array.isArray(result.result) && result.result.length > 0) {
				const block: UserContent = [
					{
						text: `<tool_result>
					<tool_name>${result.name}</tool_name>
					<tool_output>`,
						type: "text",
					},
					...result.result,
					{
						text: `</tool_output>
					</tool_result>`,
						type: "text",
					},
				]
				return block
			}

			return result.result
		})
		return blocks
	}

	private async processTool(tool: BaseAgentTool): Promise<void> {
		if (this.isAborting) {
			return
		}

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
				updateAsk: this.koduDev.taskExecutor.updateAsk.bind(this.options.koduDev.taskExecutor),
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
		if (this.isAborting) {
			return
		}

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

	public async resetToolState() {
		await this.abortTask()
	}
}
