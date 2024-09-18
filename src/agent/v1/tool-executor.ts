import treeKill from "tree-kill"
import { ToolResponse } from "./types"
import { KoduDev } from "."
import { AgentToolOptions, AgentToolParams } from "./tools/types"
import {
	SearchFilesTool,
	ListFilesTool,
	ListCodeDefinitionNamesTool,
	ExecuteCommandTool,
	AttemptCompletionTool,
	AskFollowupQuestionTool,
	ReadFileTool,
	FileUpdateTool,
	WriteFileTool,
} from "./tools"
import { WebSearchTool } from "./tools/web-search-tool"
import { TerminalManager } from "../../integrations/terminal-manager"

export class ToolExecutor {
	private runningProcessId: number | undefined
	private cwd: string
	private alwaysAllowReadOnly: boolean
	private alwaysAllowWriteOnly: boolean
	private terminalManager: TerminalManager
	private koduDev: KoduDev

	constructor(options: AgentToolOptions) {
		this.cwd = options.cwd
		this.alwaysAllowReadOnly = options.alwaysAllowReadOnly
		this.alwaysAllowWriteOnly = options.alwaysAllowWriteOnly
		this.koduDev = options.koduDev
		this.terminalManager = new TerminalManager()
	}

	private get options(): AgentToolOptions {
		return {
			cwd: this.cwd,
			alwaysAllowReadOnly: this.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: this.alwaysAllowWriteOnly,
			koduDev: this.koduDev,
			setRunningProcessId: this.setRunningProcessId,
		}
	}

	async executeTool(params: AgentToolParams): Promise<ToolResponse> {
		switch (params.name) {
			case "update_file":
				return new FileUpdateTool(params, this.options).execute()
			case "read_file":
				return new ReadFileTool(params, this.options).execute()
			case "list_files":
				return new ListFilesTool(params, this.options).execute()
			case "search_files":
				return new SearchFilesTool(params, this.options).execute()
			case "write_to_file":
				return new WriteFileTool(params, this.options).execute()
			case "list_code_definition_names":
				return new ListCodeDefinitionNamesTool(params, this.options).execute()
			case "execute_command":
				return new ExecuteCommandTool(params, this.options).execute()
			case "ask_followup_question":
				return new AskFollowupQuestionTool(params, this.options).execute()
			case "attempt_completion":
				return new AttemptCompletionTool(params, this.options).execute()
			case "web_search":
				return new WebSearchTool(params, this.options).execute()
			default:
				return `Unknown tool: ${params.name}`
		}
	}

	setAlwaysAllowReadOnly(value: boolean) {
		this.alwaysAllowReadOnly = value
	}

	setAlwaysAllowWriteOnly(value: boolean) {
		this.alwaysAllowWriteOnly = value
	}

	setRunningProcessId(pid: number | undefined) {
		this.runningProcessId = pid
	}

	abortTask() {
		const runningProcessId = this.runningProcessId
		if (runningProcessId) {
			treeKill(runningProcessId, "SIGTERM")
		}
	}
}
