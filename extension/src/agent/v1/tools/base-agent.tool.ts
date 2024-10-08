import Anthropic from "@anthropic-ai/sdk"
import { KoduDev } from ".."
import { ToolResponse } from "../types"
import { AgentToolOptions, AgentToolParams } from "./types"
import { formatImagesIntoBlocks, getPotentiallyRelevantDetails } from "../utils"

export abstract class BaseAgentTool {
	protected static readonly TASK_HISTORY_FILENAME = ".kodu.md"

	protected cwd: string
	protected alwaysAllowReadOnly: boolean
	protected alwaysAllowWriteOnly: boolean
	protected koduDev: KoduDev
	protected setRunningProcessId: (pid: number | undefined) => void

	protected abstract params: AgentToolParams

	constructor(options: AgentToolOptions) {
		this.cwd = options.cwd
		this.alwaysAllowReadOnly = options.alwaysAllowReadOnly
		this.alwaysAllowWriteOnly = options.alwaysAllowWriteOnly
		this.koduDev = options.koduDev
		this.setRunningProcessId = options.setRunningProcessId!
	}

	abstract execute(params: AgentToolParams): Promise<ToolResponse>
	public async formatToolDeniedFeedback(feedback?: string) {
		return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`
	}
	async formatGenericToolFeedback(feedback?: string) {
		return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>\n\n${await getPotentiallyRelevantDetails()}`
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
	protected get options(): AgentToolOptions {
		return {
			cwd: this.cwd,
			alwaysAllowReadOnly: this.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: this.alwaysAllowWriteOnly,
			koduDev: this.koduDev,
			setRunningProcessId: this.setRunningProcessId,
		}
	}
}
