/**
 * @fileoverview Tool Executor manages the lifecycle and execution of various tools in the Kodu extension.
 * It handles tool creation, execution queuing, state management, and cleanup of running tools.
 */

import treeKill from "tree-kill"
import { ToolName, ToolResponse, ToolResponseV2, UserContent } from "../types"
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
	FileEditorTool,
	UrlScreenshotTool,
	FileChangePlanTool,
} from "."
import { WebSearchTool } from "./runners/web-search-tool"
import { SearchSymbolsTool } from "./runners/search-symbols.tool"
import { AddInterestedFileTool } from "./runners/add-interested-file.tool"
import { BaseAgentTool } from "./base-agent.tool"
import ToolParser from "./tool-parser/tool-parser"
import { tools, writeToFileTool } from "./schema"
import pWaitFor from "p-wait-for"
import PQueue from "p-queue"
import { ChatTool } from "../../../shared/new-tools"
import { DevServerTool } from "./runners/dev-server.tool"

/**
 * Represents the context and state of a tool during its lifecycle
 * @interface ToolContext
 */
interface ToolContext {
	/** Unique identifier for the tool context */
	id: string
	/** Instance of the tool being executed */
	tool: BaseAgentTool
	/** Current execution status of the tool */
	status: "pending" | "processing" | "completed" | "error"
	/** Error object if the tool execution failed */
	error?: Error
}

/**
 * Manages the execution and lifecycle of tools in the Kodu extension
 * Handles tool creation, queuing, state management, and cleanup
 */
export class ToolExecutor {
	/** Process ID of the currently running tool, if any */
	private runningProcessId: number | undefined
	/** Current working directory for tool execution */
	private readonly cwd: string
	/** Reference to the KoduDev instance */
	private readonly koduDev: KoduDev
	/** Parser for handling tool commands and updates */
	private readonly toolParser: ToolParser
	/** Queue for managing sequential tool execution */
	private readonly queue: PQueue

	/** Map of active tool contexts indexed by their IDs */
	private toolContexts: Map<string, ToolContext> = new Map()
	/** Array of completed tool execution results */
	private toolResults: { name: string; result: ToolResponseV2 }[] = []
	/** Flag indicating if tool execution is being aborted */
	private isAborting: boolean = false

	/**
	 * Creates a new ToolExecutor instance
	 * @param options Configuration options for the tool executor
	 */
	constructor(options: AgentToolOptions) {
		this.cwd = options.cwd
		this.koduDev = options.koduDev
		this.queue = new PQueue({ concurrency: 1 })

		this.toolParser = new ToolParser(
			tools
				.map((tool) => tool.schema)
				.concat([
					{
						name: "edit_file_blocks",
						schema: writeToFileTool.schema.schema,
					},
				]),
			{
				onToolUpdate: this.handleToolUpdate.bind(this),
				onToolEnd: this.handleToolEnd.bind(this),
				onToolError: this.handleToolError.bind(this),
			}
		)
	}

	/**
	 * Gets the current tool execution options
	 * @returns Configuration options for tool execution
	 */
	public get options(): AgentToolOptions {
		return {
			cwd: this.cwd,
			alwaysAllowReadOnly: this.koduDev.getStateManager().alwaysAllowReadOnly,
			alwaysAllowWriteOnly: this.koduDev.getStateManager().alwaysAllowWriteOnly,
			koduDev: this.koduDev,
			setRunningProcessId: this.setRunningProcessId.bind(this),
		}
	}

	/**
	 * Checks if there are any tools currently active or queued
	 * @returns True if there are active or queued tools, false otherwise
	 */
	public hasActiveTools(): boolean {
		return this.toolContexts.size > 0 || this.queue.size > 0
	}

	/**
	 * Creates a new tool instance based on the provided parameters
	 * @param params Parameters for creating the tool
	 * @returns New instance of the specified tool
	 * @throws Error if the tool type is unknown
	 */
	private createTool(params: AgentToolParams): BaseAgentTool {
		const toolMap = {
			read_file: ReadFileTool,
			list_files: ListFilesTool,
			search_files: SearchFilesTool,
			write_to_file: FileEditorTool,
			edit_file_blocks: FileEditorTool,
			list_code_definition_names: ListCodeDefinitionNamesTool,
			execute_command: ExecuteCommandTool,
			ask_followup_question: AskFollowupQuestionTool,
			attempt_completion: AttemptCompletionTool,
			web_search: WebSearchTool,
			url_screenshot: UrlScreenshotTool,
			server_runner_tool: DevServerTool,
			search_symbols: SearchSymbolsTool,
			add_interested_file: AddInterestedFileTool,
			file_changes_plan: FileChangePlanTool,
		} as const

		const ToolClass = toolMap[params.name as keyof typeof toolMap]
		if (!ToolClass) {
			throw new Error(`Unknown tool: ${params.name}`)
		}

		// Cast params to any to bypass type checking since we know the tool implementations
		// handle their own type validation
		return new ToolClass(params, this.options)
	}

	/**
	 * Sets the ID of the currently running process
	 * @param pid Process ID to set, or undefined to clear
	 */
	public setRunningProcessId(pid: number | undefined) {
		this.runningProcessId = pid
	}

	/**
	 * Aborts all currently running tools and cleans up resources
	 * Kills running processes, clears the queue, and resets tool states
	 */
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

				// Capture interrupted tool results before cleanup
				for (const context of this.toolContexts.values()) {
					if (context.status === "processing") {
						this.toolResults.push({
							name: context.tool.name,
							result: {
								toolName: context.tool.name,
								toolId: context.id,
								status: "error",
								text: "Tool execution was interrupted",
							},
						})
					}
				}

				const cancelPromises = Array.from(this.toolContexts.values()).map((context) =>
					context.tool
						.abortToolExecution()
						.catch((error) => console.error(`Error cancelling tool ${context.id}:`, error))
				)

				await Promise.allSettled(cancelPromises)
				await this.queue.onIdle()

				this.toolContexts.clear()
			}

			await cleanup()
		} catch (error) {
			console.error("Cleanup error:", error)
		} finally {
			this.isAborting = false
		}
	}

	/**
	 * Processes a tool use command from text input
	 * @param text The tool use command text to process
	 * @returns Object containing the processed output
	 */
	public async processToolUse(text: string) {
		if (this.isAborting) {
			return { output: text }
		}
		return this.toolParser.appendText(text)
	}

	/**
	 * Waits for all queued and active tools to complete processing
	 * Uses polling to check the queue status at regular intervals
	 */
	public async waitForToolProcessing(): Promise<void> {
		// use pwaitfor to wait for the queue to be idle
		await pWaitFor(() => this.queue.size === 0 && this.queue.pending === 0, {
			interval: 50,
			// after 6 minutes, give up
			timeout: 6 * 60 * 1000,
		})
	}

	/**
	 * Handles updates to a tool's state during execution
	 * @param id Tool context ID
	 * @param toolName Name of the tool
	 * @param params Updated tool parameters
	 * @param ts Timestamp of the update
	 */
	private async handleToolUpdate(id: string, toolName: string, params: any, ts: number): Promise<void> {
		// check if any other tool is processing or pending if so skip the update for now
		const ifAnyToolisProcessing = Array.from(this.toolContexts.values()).some(
			(context) => context.status === "processing" || (context.status === "pending" && context.id !== id)
		)
		if (this.isAborting || ifAnyToolisProcessing) {
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
		if (context.tool instanceof FileEditorTool && params.path) {
			if (params.kodu_content) {
				if (params.kodu_content) {
					await context.tool.handlePartialUpdate(params.path, params.kodu_content)
				}
			}
			// enable after updating the animation
			if (params.kodu_diff) {
				// await this.updateToolStatus(context, params, ts)
				await context.tool.handlePartialUpdateDiff(params.path, params.kodu_diff)
			}
		} else {
			await this.updateToolStatus(context, params, ts)
		}
	}

	/**
	 * Handles the completion of a tool's execution
	 * @param id Tool context ID
	 * @param toolName Name of the tool
	 * @param params Final tool parameters
	 */
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
		// await this.updateToolStatus(context, params, context.tool.ts)
	}

	/**
	 * Handles errors that occur during tool execution
	 * @param id Tool context ID
	 * @param toolName Name of the tool
	 * @param error Error that occurred
	 * @param ts Timestamp of the error
	 */
	private async handleToolError(id: string, toolName: string, error: Error, ts: number): Promise<void> {
		console.error(`Error processing tool: ${id}`, error)

		const context = this.toolContexts.get(id)
		if (context) {
			context.status = "error"
			context.error = error
			// if (context.tool instanceof FileEditorTool) {
			// 	context.tool.
			// }
		}

		await context?.tool.abortToolExecution()

		await this.koduDev.taskExecutor.updateAsk(
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

	/**
	 * Updates the status of a tool in the UI
	 * @param context Tool context to update
	 * @param params Parameters for the update
	 * @param ts Timestamp of the update
	 */
	private updateToolStatus(context: ToolContext, params: any, ts: number) {
		this.koduDev.taskExecutor.updateAsk(
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

	/**
	 * Checks if the parser is currently within a tool tag
	 * @returns True if parser is in a tool tag, false otherwise
	 */
	public isParserInToolTag() {
		return this.toolParser.isInToolTag
	}

	/**
	 * Processes a single tool execution
	 * Handles the complete lifecycle of a tool from start to completion
	 * @param context Context of the tool to process
	 */
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
			console.log(`Tool execution completed: ${context.tool.name}`)
			context.status = "completed"
		} catch (error) {
			console.error(`Error executing tool: ${context.tool.name}`, error)
			context.status = "error"
			context.error = error as Error

			// Add error result to toolResults
			const errorMessage = error instanceof Error ? error.message : `unknown error for tool ${context.tool.name}`
			this.toolResults.push({
				name: context.tool.name,
				result: {
					toolName: context.tool.name,
					toolId: context.id,
					status: "error",
					text: this.isAborting ? "Tool execution was interrupted" : `Error: ${errorMessage}`,
				},
			})
		} finally {
			this.toolContexts.delete(context.id)
		}
	}

	/**
	 * Gets the results of all completed tool executions
	 * @returns Array of tool execution results
	 */
	public getToolResults(): { name: string; result: ToolResponseV2 }[] {
		return [...this.toolResults]
	}

	/**
	 * Resets the tool executor state
	 * Aborts any running tasks and clears results
	 */
	public async resetToolState() {
		await this.abortTask()
		this.toolResults = []
	}
}
