import * as path from "path"
import fs from "fs/promises"
import { ToolResponse } from "../types"
import { getReadablePath } from "../utils"
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
		const { content, summary } = this.params.input
		if (!content || !summary) {
			return await this.onBadInputReceived()
		}

		try {
			const absolutePath = path.resolve(this.cwd, BaseAgentTool.TASK_HISTORY_FILENAME)
			const fileExists = await fs
				.access(absolutePath)
				.then(() => true)
				.catch(() => false)

			if (!fileExists) {
				await fs.mkdir(path.dirname(absolutePath), { recursive: true })
			}
			await fs.writeFile(absolutePath, content)
			this.koduDev.getStateManager().state.taskHistory = content

			const writePath = getReadablePath(absolutePath, this.cwd)
			await this.koduDev.gitHandler.commitChanges(summary, writePath)

			return "Successfully updated task history."
		} catch (error) {
			return `Error writing file: ${JSON.stringify(serializeError(error))}
						A good example of a upsert_task_history tool call is:
			{
				"tool": "upsert_task_history",
        "summary" "Landing page accepts user email"
				"content": "## Task
- [x] Create the package.json file
- [x] Initialize the App.jsx file
- [x] Create UserForm.tsx to accept waitlist emails
- [ ] Store emails to sqlite via prisma"
			}
			Please try again with the correct markdown content.
			`
		}
	}

	private async onBadInputReceived(): Promise<ToolResponse> {
		const { summary, content } = this.params.input
		const missingParam = !summary ? "summary" : "context"

		await this.params.say(
			"error",
			`Error: Missing value for required parameter '${missingParam}'. Please provide both 'summary' and 'content' for the task history update.`
		)

		return `Error: Missing value for required parameter 'content'. Please retry with complete response.
						A good example of a upsert_task_history tool call is:
			{
				"tool": "upsert_task_history",
        "summary" "Landing page accepts user email"
				"content": "## Task
- [x] Create the package.json file
- [x] Initialize the App.jsx file
- [x] Create UserForm.tsx to accept waitlist emails
- [ ] Store emails to sqlite via prisma"
			Please try again with the correct markdown content..
			`
	}
}
