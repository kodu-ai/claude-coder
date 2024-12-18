import { KoduDev } from ".."
import { StateManager } from "../state-manager"
import { ToolExecutor } from "../tools/tool-executor"
import { Tool } from "../tools/schema"
import { getCwd } from "../utils"

export interface HookOptions {
	/**
	 * Name of the hook for identification
	 */
	hookName: string

	/**
	 * Custom prompt/instructions for this hook
	 */
	hookPrompt: string

	/**
	 * List of tools this hook has access to
	 */
	allowedTools?: Tool["schema"]["name"][]

	/**
	 * Optional memory/context to initialize the hook with
	 */
	initialMemory?: string

	/**
	 * Number of requests before triggering the hook
	 */
	triggerEvery?: number

	/**
	 * Additional options specific to each hook type
	 */
	[key: string]: any
}

export interface HookState {
	/**
	 * Parent agent's task ID
	 */
	parentTaskId: string

	/**
	 * Hook specific memory/context
	 */
	hookMemory?: string

	/**
	 * Tools this hook has access to
	 */
	allowedTools: Tool["schema"]["name"][]

	/**
	 * Counter for requests since last trigger
	 */
	requestsSinceLastTrigger: number
}

/**
 * Base class for implementing hooks that can inject content into requests
 */
export abstract class BaseHook {
	protected hookState: HookState
	protected stateManager: StateManager
	protected toolExecutor: ToolExecutor
	protected _hookOptions: HookOptions
	protected koduDev: KoduDev

	get hookOptions(): HookOptions {
		return this._hookOptions
	}

	constructor(options: HookOptions, koduDev: KoduDev) {
		this._hookOptions = options
		this.koduDev = koduDev

		// Initialize hook state
		this.hookState = {
			parentTaskId: this.koduDev.getStateManager().state.taskId,
			allowedTools: this._hookOptions.allowedTools || [],
			hookMemory: this._hookOptions.initialMemory,
			requestsSinceLastTrigger: 0,
		}

		// Create state manager with limited scope
		this.stateManager = new StateManager({
			provider: this.koduDev.providerRef.deref()!,
			customInstructions: this._hookOptions.hookPrompt,
			alwaysAllowReadOnly: true,
			alwaysAllowWriteOnly: false,
			apiConfiguration: this.koduDev.getApiManager().getApi().options,
		})

		// Create tool executor with restricted access
		this.toolExecutor = new ToolExecutor({
			cwd: getCwd(),
			alwaysAllowReadOnly: true,
			alwaysAllowWriteOnly: false,
			koduDev: this.koduDev,
		})
	}

	/**
	 * Check if the hook should be triggered
	 */
	public shouldTrigger(): boolean {
		if (!this._hookOptions.triggerEvery) {
			return false
		}

		this.hookState.requestsSinceLastTrigger++
		if (this.hookState.requestsSinceLastTrigger >= this._hookOptions.triggerEvery) {
			this.hookState.requestsSinceLastTrigger = 0
			return true
		}

		return false
	}

	/**
	 * Execute the hook and return content to inject
	 */
	public async execute(): Promise<string | null> {
		try {
			// Execute hook specific logic
			const result = await this.executeHook()

			// Update memory if needed
			if (result) {
				this.hookState.hookMemory = result
			}

			return result
		} catch (error) {
			console.error(`Hook ${this._hookOptions.hookName} failed:`, error)
			return null
		}
	}

	/**
	 * Abstract method to be implemented by specific hooks
	 */
	protected abstract executeHook(): Promise<string | null>
}
