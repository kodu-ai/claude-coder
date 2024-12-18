import { BaseAgentTool, FullToolParams } from "../base-agent.tool"
import { AgentToolParams } from "../types"
import { SubAgentToolParams, SubAgentState } from "../schema/sub_agent"
import { StateManager } from "../../state-manager"
import { ToolExecutor } from "../tool-executor"
import { KoduDevState, ToolResponseV2 } from "../../types"

/**
 * Base class for implementing sub-agents as tools
 * Handles state management, tool access control, and execution flow
 */
export abstract class BaseSubAgentTool extends BaseAgentTool<SubAgentToolParams> {
	protected subAgentState: SubAgentState
	protected stateManager: StateManager
	protected toolExecutor: ToolExecutor
	protected agentOptions: SubAgentToolParams["input"]["options"]

	constructor(params: FullToolParams<SubAgentToolParams>, options: any) {
		super(params, options)

		this.agentOptions = params.input.options

		// Initialize sub-agent state
		this.subAgentState = {
			parentTaskId: this.koduDev.getStateManager().state.taskId,
			allowedTools: this.agentOptions.allowedTools || [],
			agentMemory: this.agentOptions.initialMemory,
		}

		// Create state manager with limited scope
		this.stateManager = new StateManager({
			...options,
			customInstructions: this.agentOptions.agentPrompt,
			provider: this.koduDev.providerRef.deref()!,
		})

		// Create tool executor with restricted access
		this.toolExecutor = new ToolExecutor({
			...options,
			koduDev: this.koduDev,
			allowedTools: this.subAgentState.allowedTools,
		})
	}

	/**
	 * Main execution method that handles the sub-agent lifecycle
	 */
	public async execute(params: AgentToolParams): Promise<ToolResponseV2> {
		try {
			// Initialize execution
			await this.initializeExecution()

			// Execute sub-agent specific logic
			const result = await this.executeSubAgent(params)

			// Sync state changes back to parent
			await this.syncStateWithParent()

			// Return tool response with state updates
			return {
				status: "success",
				toolName: this.name,
				toolId: this.id,
				text: result,
			}
		} catch (error) {
			return {
				status: "error",
				toolName: this.name,
				toolId: this.id,
				text: error instanceof Error ? error.message : "Sub-agent execution failed",
			}
		}
	}

	/**
	 * Initialize the sub-agent execution environment
	 */
	protected async initializeExecution(): Promise<void> {
		// Set up initial state
		await this.stateManager.setState({
			...this.stateManager.state,
			taskId: `${this.subAgentState.parentTaskId}_${this.agentOptions.agentName}`,
			memory: this.subAgentState.agentMemory,
		})
	}

	/**
	 * Get state updates that should be synchronized with parent
	 */
	protected getStateUpdates(): Partial<KoduDevState> {
		return {
			interestedFiles: this.stateManager.state.interestedFiles,
			memory: this.stateManager.state.memory,
		}
	}

	/**
	 * Sync relevant state changes back to parent agent
	 */
	protected async syncStateWithParent(): Promise<void> {
		const updates = this.getStateUpdates()
		const parentState = this.koduDev.getStateManager().state

		// Merge interested files
		if (updates.interestedFiles) {
			parentState.interestedFiles = [...(parentState.interestedFiles || []), ...updates.interestedFiles]
		}

		// Update memory if changed
		if (updates.memory) {
			parentState.memory = updates.memory
		}
	}

	/**
	 * Abstract method to be implemented by specific sub-agents
	 */
	protected abstract executeSubAgent(params: AgentToolParams): Promise<string>
}
