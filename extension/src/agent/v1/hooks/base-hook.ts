import { KoduDev } from ".."
import { StateManager } from "../state-manager"
import { ToolExecutor } from "../tools/tool-executor"
import { Tool } from "../tools/schema"
import { getCwd } from "../utils"

export interface HookOptions {
	/**
	 * Number of requests before triggering the hook
	 */
	triggerEvery?: number

	/**
	 * Hook name
	 */
	hookName: string
}

export interface HookState {
	/**
	 * Parent agent's task ID
	 */
	taskId: string

	/**
	 * Hook name
	 */
	hookName: string
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
			taskId: this.koduDev.getStateManager().state.taskId,
			requestsSinceLastTrigger: 0,
			hookName: options.hookName,
		}
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
