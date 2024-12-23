import { ToolPromptSchema } from "../utils/utils"

export const executeCommandPrompt: ToolPromptSchema = {
	name: "execute_command",
	description:
		"Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will be executed in the current working directory: {{cwd}}",
	parameters: {
		command: {
			type: "string",
			description:
				"The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.\nCOMMAND CANNOT RUN SOMETHING like 'npm start', 'yarn start', 'python -m http.server', etc. (if you want to start a server, you must use the server_runner tool.)",
			required: true,
		},
	},
	capabilities: [
		"You can use execute_command tool to execute a CLI command on the system, this tool is useful when you need to perform system operations or run specific commands to accomplish any step in the user's task, you must tailor your command to the user's system and provide a clear explanation of what the command does, prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run.",
	],

	examples: [
		{
			description: "Requesting to execute a command",
			output: `<execute_command>
<command>npm install express</command>
</execute_command>`,
		},
	],
}
