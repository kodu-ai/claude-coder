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
	result?: ToolResponse
}

export class ToolExecutor {
	private runningProcessId: number | undefined
	private readonly cwd: string
	private readonly koduDev: KoduDev
	private readonly toolParser: ToolParser
	private readonly queue: PQueue
	private isAborting: boolean = false

	private toolContexts: Map<string, ToolContext> = new Map()
	private toolResults: { name: string; result: ToolResponse }[] = []

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
		const hasQueuedTools = this.queue.size > 0
		return hasQueuedTools
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
					await new Promise<void>((resolve, reject) => {
						const timeout = setTimeout(() => {
							reject(new Error("Process kill timeout"))
						}, 5000) // 5 second timeout

						treeKill(this.runningProcessId!, "SIGTERM", (err) => {
							clearTimeout(timeout)
							if (err) {
								console.error("Error killing process:", err)
							}
							this.runningProcessId = undefined
							resolve()
						})
					}).catch(error => {
						console.error("Failed to kill process:", error)
						// Force kill as fallback
						try {
							treeKill(this.runningProcessId!, "SIGKILL")
						} catch (e) {
							console.error("Force kill failed:", e)
						}
						this.runningProcessId = undefined
						resolve()
					})
				})
			}

			// Capture interrupted tool results
			for (const context of this.toolContexts.values()) {
				if (context.status === "processing") {
					this.toolResults.push({
						name: context.tool.name,
						result: "Tool execution was interrupted",
					})
				}
			}

			// Cancel all pending tools
			const cancelPromises = Array.from(this.toolContexts.values()).map(async (context) => {
				try {
					await context.tool.abortToolExecution()
				} catch (error) {
					console.error(`Error cancelling tool ${context.id}:`, error)
				}
			})

			await Promise.allSettled(cancelPromises)
			await this.queue.onIdle()

			this.toolContexts.clear()
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

	public async waitForToolProcessing(): Promise<void> {
		await pWaitFor(async () => {
			const contexts = Array.from(this.toolContexts.values())
			const allCompleted = contexts.every(
				(context) => context.status === "completed" && context.result !== undefined
			)
			const queueEmpty = this.queue.size === 0

			return allCompleted && queueEmpty
		})
	}

	private async handleToolUpdate(id: string, toolName: string, params: any, ts: number): Promise<void> {
		console.log(`[ToolExecutor] Handling tool update: ${toolName}`)
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
		}

		context.tool.updateParams(params)
		context.tool.updateIsFinal(false)

		// Handle partial updates for write file tool
		if (context.tool instanceof WriteFileTool && params.path && params.content) {
			context.tool.handlePartialUpdate(params.path, params.content)
		} else {
			await this.updateToolStatus(context, params, ts)
		}
	}

	private async handleToolEnd(id: string, toolName: string, params: any): Promise<void> {
		console.log(`[ToolExecutor] Handling tool end: ${toolName}`)
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

		console.log(`[ToolExecutor] Updating tool final status: ${toolName}`)
		await this.updateToolStatus(context, params, context.tool.ts)

		// Execute tool and wait for completion
		console.log(`[ToolExecutor] Adding tool to queue: ${toolName}`)
		const queuePromise = new Promise<void>((resolve, reject) => {
			this.queue.add(async () => {
				try {
					const result = await this.processTool(context!)
					context!.result = result
					this.toolResults.push({ name: context!.tool.name, result })
					resolve()
				} catch (error) {
					reject(error)
				}
			})
		})

		// Wait for both queue processing and tool execution
		await queuePromise
		await this.waitForToolProcessing()
	}

	private async handleToolError(id: string, toolName: string, error: Error, ts: number): Promise<void> {
		console.error(`[ToolExecutor] Error processing tool: ${id}`, error)

		const context = this.toolContexts.get(id)
		if (context) {
			context.status = "error"
			context.error = error
			context.result = `Error: ${error.message}`
		}

		await this.koduDev.taskExecutor.updateAsk(
			"tool",
			{
				// @ts-expect-error
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

	private async updateToolStatus(context: ToolContext, params: any, ts: number) {
		await this.koduDev.taskExecutor.updateAsk(
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

	private async processTool(context: ToolContext): Promise<ToolResponse> {
		console.log(`[ToolExecutor] Processing tool: ${context.tool.name}`)
		if (this.isAborting) {
			console.log(`Tool is aborting, skipping tool: ${context.tool.name}`)
			return "Tool execution was interrupted"
		}

		console.log(`[ToolExecutor] Waiting for tool to be final: ${context.tool.name}`)
		await pWaitFor(() => context.tool.isFinal)

		try {
			context.status = "processing"
			if (this.isAborting) {
				return
			}
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

			console.log(`[ToolExecutor] Tool execution completed: ${context.tool.name} at ${Date.now()}`)
			context.status = "completed"
			return result
		} catch (error) {
			console.error(`[ToolExecutor] Error executing tool: ${context.tool.name}`, error)
			context.status = "error"
			context.error = error as Error

			// Update tool status to error
			await this.koduDev.taskExecutor.updateAsk(
				"tool",
				{
					tool: {
						// @ts-expect-error
						tool: context.tool.name,
						...context.tool.paramsInput,
						ts: context.tool.ts,
						approvalState: "error",
						error: error instanceof Error ? error.message : "Unknown error occurred",
					},
				},
				context.tool.ts
			)

			return this.isAborting
				? "Tool execution was interrupted"
				: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`
		}
	}

	public async resetToolState() {
		console.log("[ToolExecutor] Resetting tool state")
		await this.abortTask()
		this.toolResults = []
		this.queue.clear()
	}

	public getToolResults(): { name: string; result: ToolResponse }[] {
		return [...this.toolResults]
	}

	public async resetToolState() {
		this.toolResults = []
		await this.abortTask()
	}
}
