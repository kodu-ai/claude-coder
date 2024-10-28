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
} from "."
import { WebSearchTool } from "./runners/web-search-tool"
import { BaseAgentTool } from "./base-agent.tool"
import ToolParser from "./tool-parser/tool-parser"
import { tools } from "./schema"
import pWaitFor from "p-wait-for"
import PQueue from "p-queue"
import { ChatTool } from "../../../shared/new-tools"
import { DevServerTool } from "./runners/dev-server.tool"

interface ToolContext {
	id: string
	tool: BaseAgentTool
	status: "pending" | "processing" | "completed" | "error"
	error?: Error
}

export class ToolExecutor {
	private runningProcessId: number | undefined
	private readonly cwd: string
	private readonly koduDev: KoduDev
	private readonly toolParser: ToolParser
	private readonly queue: PQueue

	private toolContexts: Map<string, ToolContext> = new Map()
	private toolResults: { name: string; result: ToolResponse }[] = []
	private isAborting: boolean = false

	constructor(options: AgentToolOptions) {
		this.cwd = options.cwd
		this.koduDev = options.koduDev
		this.queue = new PQueue({ concurrency: 1 })

		this.toolParser = new ToolParser(
			tools.map((tool) => tool.schema),
			{
				onToolUpdate: this.handleToolUpdate.bind(this),
				onToolEnd: this.handleToolEnd.bind(this),
				onToolError: this.handleToolError.bind(this),
			}
		)
	}

	public get options(): AgentToolOptions {
		return {
			cwd: this.cwd,
			alwaysAllowReadOnly: this.koduDev.getStateManager().alwaysAllowReadOnly,
			alwaysAllowWriteOnly: this.koduDev.getStateManager().alwaysAllowWriteOnly,
			koduDev: this.koduDev,
			setRunningProcessId: this.setRunningProcessId.bind(this),
		}
	}

	public hasActiveTools(): boolean {
		return this.toolContexts.size > 0 || this.queue.size > 0
	}

	private createTool(params: AgentToolParams): BaseAgentTool {
		const toolMap = {
			read_file: ReadFileTool,
			list_files: ListFilesTool,
			search_files: SearchFilesTool,
			write_to_file: WriteFileTool,
			list_code_definition_names: ListCodeDefinitionNamesTool,
			execute_command: ExecuteCommandTool,
			ask_followup_question: AskFollowupQuestionTool,
			attempt_completion: AttemptCompletionTool,
			web_search: WebSearchTool,
			url_screenshot: UrlScreenshotTool,
			ask_consultant: AskConsultantTool,
			server_runner_tool: DevServerTool,
		}

		const ToolClass = toolMap[params.name as keyof typeof toolMap]
		if (!ToolClass) {
			throw new Error(`Unknown tool: ${params.name}`)
		}

		return new ToolClass(params, this.options)
	}

	public async executeTool(params: AgentToolParams): Promise<ToolResponse> {
		if (this.isAborting) {
			throw new Error("Cannot execute tool while aborting")
		}

		const tool = this.createTool(params)
		return tool.execute(params)
	}

	public setRunningProcessId(pid: number | undefined) {
		this.runningProcessId = pid
	}

	public async abortTask(): Promise<void> {
		if (this.isAborting) {
			return
		}

		this.isAborting = true
		try {
			this.queue.clear()
			this.toolParser.reset()

			const cleanup = async () => {
				if (this.runningProcessId) {
					await new Promise<void>((resolve) => {
						treeKill(this.runningProcessId!, "SIGTERM", (err) => {
							if (err) {
								console.error("Error killing process:", err)
							}
							this.runningProcessId = undefined
							resolve()
						})
					})
				}

				const cancelPromises = Array.from(this.toolContexts.values()).map((context) =>
					context.tool
						.abortToolExecution()
						.catch((error) => console.error(`Error cancelling tool ${context.id}:`, error))
				)

				await Promise.allSettled(cancelPromises)
				await this.queue.onIdle()

				this.toolContexts.clear()
				this.toolResults = []
			}

			await cleanup()
		} catch (error) {
			console.error("Cleanup error:", error)
		} finally {
			this.isAborting = false
		}
	}

	public async processToolUse(text: string): Promise<string> {
		if (this.isAborting) {
			return text
		}
		return this.toolParser.appendText(text)
	}

	private async handleToolUpdate(id: string, toolName: string, params: any, ts: number): Promise<void> {
		if (this.isAborting) {
			return
		}

		let context = this.toolContexts.get(id)
		if (!context) {
			const tool = this.createTool({
				name: toolName as ToolName,
				input: params,
				id,
				ts,
				isFinal: false,
				isLastWriteToFile: false,
				ask: this.koduDev.taskExecutor.askWithId.bind(this.koduDev.taskExecutor),
				say: this.koduDev.taskExecutor.say.bind(this.koduDev.taskExecutor),
				updateAsk: this.koduDev.taskExecutor.updateAsk.bind(this.koduDev.taskExecutor),
			})

			context = { id, tool, status: "pending" }
			this.toolContexts.set(id, context)
		} else {
			context.tool.updateParams(params)
			context.tool.updateIsFinal(false)
		}

		// Handle partial updates for write file tool
		if (context.tool instanceof WriteFileTool && params.path && params.content) {
			await context.tool.handlePartialUpdate(params.path, params.content)
		}

		await this.updateToolStatus(context, params, ts)
	}

	private async handleToolEnd(id: string, toolName: string, params: any): Promise<void> {
		if (this.isAborting) {
			console.log(`Tool is aborting, skipping tool: ${toolName}`)
			return
		}

		let context = this.toolContexts.get(id)
		if (!context) {
			const tool = this.createTool({
				name: toolName as ToolName,
				input: params,
				id,
				ts: Date.now(),
				isFinal: true,
				isLastWriteToFile: false,
				ask: this.koduDev.taskExecutor.askWithId.bind(this.koduDev.taskExecutor),
				say: this.koduDev.taskExecutor.say.bind(this.koduDev.taskExecutor),
				updateAsk: this.koduDev.taskExecutor.updateAsk.bind(this.koduDev.taskExecutor),
			})

			context = { id, tool, status: "pending" }
			this.toolContexts.set(id, context)
		}

		context.tool.updateParams(params)
		context.tool.updateIsFinal(true)

		this.queue.add(() => this.processTool(context!))
		await this.updateToolStatus(context, params, context.tool.ts)
	}

	private async handleToolError(id: string, toolName: string, error: Error, ts: number): Promise<void> {
		console.error(`Error processing tool: ${id}`, error)

		const context = this.toolContexts.get(id)
		if (context) {
			context.status = "error"
			context.error = error
		}

		await this.koduDev.taskExecutor.askWithId(
			"tool",
			{
				// @ts-expect-error - not typedd correctly
				tool: {
					tool: toolName as ChatTool["tool"],
					ts,
					approvalState: "error",
					...context?.tool.paramsInput!,
					error: error.message,
				},
			},
			ts
		)
	}

	private async updateToolStatus(context: ToolContext, params: any, ts: number): Promise<void> {
		if (context.tool instanceof WriteFileTool && !context.tool.diffViewProvider.isEditing) {
			await this.koduDev.taskExecutor.askWithId(
				"tool",
				{
					tool: {
						tool: context.tool.name,
						...params,
						ts,
						approvalState: "loading",
					},
				},
				ts
			)
		}
	}

	private async processTool(context: ToolContext): Promise<void> {
		if (this.isAborting) {
			return
		}

		await pWaitFor(() => context.tool.isFinal, { interval: 50 })

		try {
			context.status = "processing"
			const result = await context.tool.execute({
				name: context.tool.name as ToolName,
				input: context.tool.paramsInput,
				id: context.tool.id,
				ts: context.tool.ts,
				isFinal: true,
				isLastWriteToFile: false,
				ask: this.koduDev.taskExecutor.askWithId.bind(this.koduDev.taskExecutor),
				say: this.koduDev.taskExecutor.say.bind(this.koduDev.taskExecutor),
				updateAsk: this.koduDev.taskExecutor.updateAsk.bind(this.koduDev.taskExecutor),
			})

			this.toolResults.push({ name: context.tool.name, result })
			context.status = "completed"
		} catch (error) {
			console.error(`Error executing tool: ${context.tool.name}`, error)
			context.status = "error"
			context.error = error as Error
			this.toolResults.push({
				name: context.tool.name,
				result: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			})
		} finally {
			this.toolContexts.delete(context.id)
		}
	}

	public async waitForToolProcessing(): Promise<void> {
		// use pwaitfor to wait for the queue to be idle
		await pWaitFor(() => this.queue.size === 0 && this.queue.pending === 0, { interval: 10 })
	}

	public getToolResults(): { name: string; result: ToolResponse }[] {
		return [...this.toolResults]
	}

	public async resetToolState() {
		await this.abortTask()
	}
}
