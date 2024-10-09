import { ToolResponse } from "../types"
import { BaseAgentTool } from "./base-agent.tool"
import type { AgentToolOptions, AgentToolParams } from "./types"

export class ReadTaskHistoryTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		return this.koduDev.getStateManager().state.memory ?? "Error: Memory is empty. Please update memory first."
	}
}
