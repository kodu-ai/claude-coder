import dedent from "dedent"
import { BaseAgentTool } from "../../base-agent.tool"
import { ExitAgentToolParams } from "../../schema/agents/agent-exit"

export class ExitAgentTool extends BaseAgentTool<ExitAgentToolParams> {
	async execute() {
		const { input, ask, say } = this.params
		const { result } = input

		const agentName = this.koduDev.getStateManager().subAgentManager.state?.name
		if (!agentName) {
			return this.toolResponse("error", "No sub-agent is currently running.")
		}

		ask(
			"tool",
			{
				tool: {
					tool: "exit_agent",
					agentName,
					result,
					ts: this.ts,
					approvalState: "approved",
				},
			},
			this.ts
		)

		// this will exit the sub-agent and return back to the main agent
		await this.koduDev.getStateManager().subAgentManager.exitSubAgent()

		return this.toolResponse(
			"success",
			dedent`<completion_tool_response>
                <status>
                    <result>success</result>
                    <operation>spawn_agent_result</operation>
                    <agent_name>${agentName}</agent_name>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <result>
                    <message>Agent exited successfully</message>
                    <output>${result}</output>
                </result>
            </completion_tool_response>`
		)
	}
}
