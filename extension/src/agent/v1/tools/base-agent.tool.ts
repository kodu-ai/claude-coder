import Anthropic from "@anthropic-ai/sdk"
import { KoduDev } from ".."
import { ToolName, ToolResponse, ToolResponseV2 } from "../types"
import { AgentToolOptions, AgentToolParams, ToolInput, ToolNames, CommitInfo } from "./types"
import { formatImagesIntoBlocks, getPotentiallyRelevantDetails } from "../utils"

// Make the class generic with ToolInputForName type parameter

type ToolInputForName<T extends ToolNames> = Extract<ToolInput, { name: T }>

export abstract class BaseAgentTool<TName extends ToolNames> {
	protected cwd: string
	protected alwaysAllowReadOnly: boolean
	protected alwaysAllowWriteOnly: boolean
	protected koduDev: KoduDev
	protected isAbortingTool: boolean = false
	protected setRunningProcessId: (pid: number | undefined) => void

	// Update params to use the generic type
	protected abstract params: {
		name: string
		id: string
		input: ToolInputForName<TName>
		ts: number
		isSubMsg?: boolean
		isLastWriteToFile: boolean
		isFinal?: boolean
	}

	constructor(options: AgentToolOptions) {
		this.cwd = options.cwd
		this.alwaysAllowReadOnly = options.alwaysAllowReadOnly
		this.alwaysAllowWriteOnly = options.alwaysAllowWriteOnly
		this.koduDev = options.koduDev
		this.setRunningProcessId = options.setRunningProcessId!
	}

	get name(): string {
		return this.params.name
	}
	get id(): string {
		return this.params.id
	}
	get ts(): number {
		return this.params.ts
	}

	get paramsInput(): ToolInputForName<TName> {
		return this.params.input
	}

	get toolParams() {
		return {
			...this.params,
			input: this.paramsInput,
		}
	}

	get isFinal(): boolean {
		return this.params.isFinal ?? false
	}

	// Update execute method to use the generic type
	abstract execute(params: {
		name: string
		id: string
		input: ToolInputForName<TName>
		ts: number
		isSubMsg?: boolean
		isLastWriteToFile: boolean
		isFinal?: boolean
	}): Promise<ToolResponseV2>

	public updateParams(input: ToolInputForName<TName>) {
		this.params.input = input
	}

	public updateIsFinal(isFinal: boolean) {
		this.params.isFinal = isFinal
	}

	public formatToolDeniedFeedback(feedback?: string) {
		return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`
	}
	formatGenericToolFeedback(feedback?: string) {
		return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`
	}

	public formatToolDenied() {
		return `The user denied this operation.`
	}

	public async formatToolResult(result: string) {
		return result // the successful result of the tool should never be manipulated, if we need to add details it should be as a separate user text block
	}

	public formatToolError(error?: string) {
		this.logger(`Tool execution failed with the following error: ${error}`, "error")
		return `The tool execution failed with the following error:\n<error>\n${error}\n</error>`
	}
	public formatToolResponseWithImages(text: string, images?: string[]): ToolResponse {
		if (images && images.length > 0) {
			const textBlock: Anthropic.TextBlockParam = { type: "text", text }
			const imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
			// Placing images after text leads to better results
			return [textBlock, ...imageBlocks]
		} else {
			return text
		}
	}

	public async abortToolExecution() {
		if (this.isAbortingTool) {
			return
		}
		this.isAbortingTool = true
		this.setRunningProcessId(undefined)
		console.log(`Aborted tool execution for ${this.name} with id ${this.id}`)
	}

	protected toolResponse(
		status: ToolResponseV2["status"],
		text?: string,
		images?: string[],
		commitResult?: CommitInfo
	) {
		return {
			toolName: this.name,
			toolId: this.id,
			text,
			images,
			status,
			...commitResult,
		}
	}

	protected get options(): AgentToolOptions {
		return {
			cwd: this.cwd,
			alwaysAllowReadOnly: this.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: this.alwaysAllowWriteOnly,
			koduDev: this.koduDev,
			setRunningProcessId: this.setRunningProcessId,
		}
	}

	protected logger(message: string, level: "info" | "warn" | "error" | "debug" = "info") {
		console[level](`[${this.name}] ${message}`)
	}
}
