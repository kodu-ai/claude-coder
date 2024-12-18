import { SubAgentState } from "../types"
import { IOManager } from "./io-manager"

type SubAgentManagerOptions = {
	ioManager: IOManager
	subAgentId?: number
	onEnterSucessful: (state: SubAgentState) => Promise<void>
	onExit: () => Promise<void>
}

export class SubAgentManager {
	private _ioManager: IOManager
	private _state?: SubAgentState
	private _currentSubAgentId?: number
	private _agentHash?: string
	private onEnterSucessful: (state: SubAgentState) => Promise<void>
	private onExit: () => Promise<void>

	constructor(options: SubAgentManagerOptions) {
		this._ioManager = options.ioManager
		this.onEnterSucessful = options.onEnterSucessful
		this.onExit = options.onExit
		if (options.subAgentId) {
			this.enterSubAgent(options.subAgentId)
		}
	}

	get state(): SubAgentState | undefined {
		return this._state
	}

	get agentHash(): string | undefined {
		return this._agentHash
	}

	get currentSubAgentId(): number | undefined {
		return this._currentSubAgentId
	}

	get isInSubAgent(): boolean {
		return this._currentSubAgentId !== undefined
	}

	public exitSubAgent(): void {
		this._currentSubAgentId = undefined
		this._ioManager.agentHash = undefined
		this._state = undefined
		this.onExit()
	}

	public getHash(): string {
		if (!this._state) {
			throw new Error("No current sub-agent state")
		}
		return `${this._state.ts}-${this._state.name}`
	}

	public async updateSubAgentState(subAgentId: number, state: SubAgentState): Promise<void> {
		if (!this._state) {
			throw new Error(`SubAgent with id ${subAgentId} does not exist`)
		}
		Object.assign(this._state, state)
		await this._ioManager.saveSubAgentState(this._state)
	}

	public async enterSubAgent(subAgentId: number): Promise<void> {
		this._currentSubAgentId = subAgentId
		this._ioManager.agentHash = this.getHash()

		const state = await this._ioManager.loadSubAgentState()
		if (state) {
			this._state = state
			await this.onEnterSucessful(state)
			return
		}
		// if not we exit and throw an error
		this.exitSubAgent()
		throw new Error(`SubAgent with id ${subAgentId} does not exist`)
	}

	public async spawnSubAgent(subAgentId: number, subAgentState: SubAgentState): Promise<void> {
		this._currentSubAgentId = subAgentId
		this._state = subAgentState
		this._ioManager.agentHash = this.getHash()
		await this._ioManager.saveSubAgentState(subAgentState)
		await this.onEnterSucessful(subAgentState)
	}
}
