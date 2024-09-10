import { KoduDev } from ".."
import { ToolResponse } from "../../types"
import { AgentToolOptions, AgentToolParams } from "./types"

export abstract class BaseAgentTool {
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
		this.setRunningProcessId = options.setRunningProcessId
	}

	abstract execute(params: AgentToolParams): Promise<ToolResponse>

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
