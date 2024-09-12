import { BaseAgentTool } from "./base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "./types"

export class WebSearchTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<string> {
		return "Hello World"
	}
}
