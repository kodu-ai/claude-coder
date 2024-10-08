import * as path from "path"
import fs from "fs/promises"
import { ToolResponse } from "../types"
import { BaseAgentTool } from "./base-agent.tool"
import type { AgentToolOptions, AgentToolParams } from "./types"
import { serializeError } from "serialize-error"

export class UpsertTaskHistoryTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		try {
			const absolutePath = path.resolve(this.cwd, this.TASK_HISTORY_FILENAME)
			const fileExists = await fs
				.access(absolutePath)
				.then(() => true)
				.catch(() => false)

			if (!fileExists) {
				return "Error: Task history file not found. Please create the task history file first."
			}
			const fileContent = await fs.readFile(absolutePath, "utf8")

			return fileContent
		} catch (error) {
			return `Error reading file while executing read_task_history tool: ${JSON.stringify(serializeError(error))}`
		}
	}
}
