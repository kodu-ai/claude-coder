import * as fs from "fs"
import * as path from "path"
import { ToolResponse } from "../types"
import { BaseAgentTool } from "./base-agent.tool"
import type { AgentToolOptions, AgentToolParams } from "./types"
import { serializeError } from "serialize-error"

export class ReadTaskHistoryTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		try {
			const taskHistory = ReadTaskHistoryTool.getTaskHistory(this.cwd)
			return taskHistory ?? "Error: Task history file not found. Please create the task history file first."
		} catch (error) {
			return `Error reading file while executing read_task_history tool: ${JSON.stringify(serializeError(error))}`
		}
	}

	static getTaskHistory(cwd: string): string {
		const absolutePath = path.resolve(cwd, this.TASK_HISTORY_FILENAME)
		const fileExists = fs.existsSync(absolutePath)

		if (!fileExists) {
			return ""
		}
		const fileContent = fs.readFileSync(absolutePath, "utf8")

		return fileContent
	}
}
