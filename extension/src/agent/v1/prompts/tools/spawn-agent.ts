import { ToolPromptSchema } from "../utils/types"

export const spawnAgentPrompt: ToolPromptSchema = {
	name: "spawn_agent",
	description:
		"Request to spawn a new sub-agent with specific instructions and capabilities. This tool allows you to create specialized agents for specific tasks like handling sub-tasks. The tool requires user approval before creating the agent.",
	parameters: {
		agentName: {
			type: "string",
			description:
				"The type of agent to spawn. Must be one of: 'sub_task'. Each type is specialized for different tasks:\n- sub_task: For handling specific sub-components of a larger task",
			required: true,
		},
		instructions: {
			type: "string",
			description:
				"Detailed instructions for the sub-agent, describing its task and objectives, this is will be the meta prompt for the sub-agent. give few shots examples if possible",
			required: true,
		},
		files: {
			type: "string",
			description:
				"Comma-separated list of files that the sub-agent should focus on or work with. no spaces between files just comma separated values",
			required: false,
		},
	},
	capabilities: [
		"You can use spawn_agent tool to create specialized sub-agents for specific tasks like handling sub-tasks, each agent type has its own specialized capabilities and focus areas, the tool requires user approval before creating the agent and allows you to specify which files the agent should work with, ensuring proper context and state management throughout the agent's lifecycle.",
		"Spawnning a sub-agent is a great way to break down a large task into smaller, more manageable sub-tasks. This allows you to focus on one task at a time, ensuring that each sub-task is completed successfully before moving on to the next one.",
		"By creating specialized sub-agents, you can ensure that each agent is focused on a specific task or set of tasks, allowing for more efficient and effective task completion. This can help streamline your workflow and improve overall productivity.",
	],
	examples: [
		{
			description: "Spawn an agent to install the dependencies and run the unit tests",
			output: `<spawn_agent>
<agentName>sub_task</agentName>
<instructions>Take a look at the project files and install the dependencies. Run the unit tests and report back the results with any failures.</instructions>
<files>package.json,README.md</files>
</spawn_agent>`,
		},
		{
			description: "Spawn a planner agent to break down a task",
			output: `<spawn_agent>
<agentName>planner</agentName>
<instructions>Create a detailed plan for implementing a new user dashboard feature. Break down the requirements into manageable sub-tasks and identify dependencies.</instructions>
</spawn_agent>`,
		},
	],
}
