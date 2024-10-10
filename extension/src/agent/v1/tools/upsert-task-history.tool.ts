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
		const { content, milestoneName, summary } = this.params.input
		if (!content || !milestoneName) {
			return await this.onBadInputReceived()
		}

		try {
			const taskId = this.koduDev.getStateManager().state.taskId
			const { historyItem } = await this.koduDev.providerRef.deref()?.getTaskManager().getTaskWithId(taskId)!
			const state = this.koduDev.getStateManager().state

			historyItem.memory = content
			state.memory = content

			await this.koduDev.providerRef.deref()?.getStateManager().updateTaskHistory(historyItem)
			await this.koduDev.getStateManager().setState(state)

			return "Successfully updated task history."
		} catch (error) {
			return `Error writing file: ${JSON.stringify(serializeError(error))}
						A good example of a upsert_memory tool call is:
			{
				"tool": "upsert_memory",
        "summary" "Landing page accepts user email"
				"milestoneName": "add-email-to-lp",
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
		const missingParam = !summary ? "summary" : !content ? "content" : "milestoneName"

		await this.params.say(
			"error",
			`Error: Missing value for required parameter '${missingParam}'. Please provide all values: 'summary' and 'content' for the task history update.`
		)

		return `Error: Missing value for required parameter ${missingParam}. Please retry with complete response.
						A good example of a upsert_memory tool call is:
			{
				"tool": "upsert_memory",
				"milestoneName": "add-email-to-lp",
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
