import { PLANNER_SYSTEM_PROMPT } from "../../../prompts/agents/planner.prompt"
import { PRINT_DEBUGGER_SYSTEM_PROMPT } from "../../../prompts/agents/print-debugger.prompt"
import { SUBTASK_SYSTEM_PROMPT } from "../../../prompts/agents/subtask.prompt"
import { BaseAgentTool } from "../../base-agent.tool"
import { SpawnAgentToolParams } from "../../schema/agents/agent-spawner"

export class SpawnAgentTool extends BaseAgentTool<SpawnAgentToolParams> {
	async execute() {
		const { input, ask, say } = this.params
		const { agentName, instructions, files } = input

		const filesList = files?.split(",").map((file) => file.trim()) || []

		const { response, text, images } = await ask(
			"tool",
			{
				tool: {
					tool: "spawn_agent",
					agentName,
					instructions,
					files: filesList,
					ts: this.ts,
					approvalState: "pending",
				},
			},
			this.ts
		)
		if (response !== "yesButtonTapped") {
			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "spawn_agent",
						agentName,
						instructions,
						files: filesList,
						approvalState: "rejected",
						userFeedback: text,
						ts: this.ts,
					},
				},
				this.ts
			)
			if (response === "messageResponse") {
				await say("user_feedback", text ?? "The user denied this operation.", images)
				return this.toolResponse("feedback", text, images)
			}
			return this.toolResponse("error", "Sub-agent operation cancelled by user.")
		}
		await this.params.updateAsk(
			"tool",
			{
				tool: {
					tool: "spawn_agent",
					agentName,
					instructions,
					files: filesList,
					approvalState: "approved",
					userFeedback: text,
					ts: this.ts,
				},
			},
			this.ts
		)

		let systemPrompt = ""
		switch (agentName) {
			case "planner":
				systemPrompt = PLANNER_SYSTEM_PROMPT(this.koduDev.getApiManager().getModelInfo()?.supportsImages)
				break
			case "sub_task":
				systemPrompt = SUBTASK_SYSTEM_PROMPT(this.koduDev.getApiManager().getModelInfo()?.supportsImages)
				break
			case "print_debugger":
				systemPrompt = PRINT_DEBUGGER_SYSTEM_PROMPT(this.koduDev.getApiManager().getModelInfo()?.supportsImages)
				break
		}

		// const systemPrompt

		await this.koduDev.getStateManager().subAgentManager.spawnSubAgent(this.ts, {
			name: agentName,
			state: "RUNNING",
			ts: this.ts,
			apiConversationHistory: [],
			historyErrors: {},
			systemPrompt,
		})

		return this.toolResponse(
			"success",
			`Please follow the instructions below\n\n<instructions>${instructions}</instructions>`
		)
	}
}
