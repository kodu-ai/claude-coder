import Anthropic from "@anthropic-ai/sdk"
import { ToolResponse } from "@/types"
import { AgentToolOptions, AgentToolParams } from "@/types"
import { IConsumer, IKoduDev } from "@/interfaces"
import { formatImagesIntoBlocks, getPotentiallyRelevantDetails } from "@/utils"
import { KoduDev } from "@/index"
import { IConsumerFilesAdapter } from "@/interfaces"

export abstract class BaseAgentTool {
	protected cwd: string
	protected alwaysAllowReadOnly: boolean
	protected alwaysAllowWriteOnly: boolean
	protected koduDev: KoduDev
	protected consumer: IConsumer
	protected setRunningProcessId: (pid: number | undefined) => void

	protected abstract params: AgentToolParams

	constructor(options: AgentToolOptions) {
		this.cwd = options.cwd
		this.alwaysAllowReadOnly = options.alwaysAllowReadOnly
		this.alwaysAllowWriteOnly = options.alwaysAllowWriteOnly
		this.koduDev = options.koduDev
		this.setRunningProcessId = options.setRunningProcessId!
		this.consumer = options.koduDev.consumer
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

	get paramsInput(): AgentToolParams["input"] {
		return this.params.input
	}

	get toolParams(): AgentToolParams {
		return this.params
	}

	get isFinal(): boolean {
		return this.params.isFinal ?? false
	}

	abstract execute(params: AgentToolParams): Promise<ToolResponse>

	public updateParams(input: AgentToolParams["input"]) {
		this.params.input = input
	}

	public updateIsFinal(isFinal: boolean) {
		this.params.isFinal = isFinal
	}

	public async formatToolDeniedFeedback(feedback?: string) {
		return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`
	}
	async formatGenericToolFeedback(feedback?: string) {
		return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>\n\n${await getPotentiallyRelevantDetails(
			this.consumer.filesAdapter
		)}`
	}

	public async formatToolDenied() {
		return `The user denied this operation.`
	}

	public async formatToolResult(result: string) {
		return result // the successful result of the tool should never be manipulated, if we need to add details it should be as a separate user text block
	}

	public async formatToolError(error?: string) {
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
		this.setRunningProcessId(undefined)
		console.log(`Aborted tool execution for ${this.name} with id ${this.id}`)
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

	protected get filesAdapter(): IConsumerFilesAdapter {
		return this.consumer.filesAdapter
	}
}
