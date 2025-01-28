import { ToolPromptSchema } from "../utils/utils"

export const serverRunnerPrompt: ToolPromptSchema = {
	name: "server_runner",
	description:
		"start a server / development server. This tool is used to run web applications locally, backend server, or anytype of server. this is tool allow you to start, stop, restart, or get logs from a server instance and keep it in memory.\nTHIS IS THE ONLY TOOL THAT IS CAPABLE OF STARTING A SERVER, DO NOT USE THE execute_command TOOL TO START A SERVER, I REPEAT, DO NOT USE THE execute_command TOOL TO START A SERVER.\nYOU MUST GIVE A NAME FOR EACH SERVER INSTANCE YOU START, SO YOU CAN KEEP TRACK OF THEM.\nYou must always provide all the parameters for this tool.",
	parameters: {
		commandToRun: {
			type: "string",
			description: `The CLI command to start the server. This should be valid for the current operating system. Ensure the command is properly formatted and has the correct path to the directory you want to serve (relative to the current working directory {{cwd}}).`,
			required: false,
		},
		commandType: {
			type: "string",
			description:
				"The type of command to run. Use 'start' to start the server, 'stop' to stop it, 'restart' to restart it, or 'getLogs' to retrieve logs from the server.",
			required: true,
		},
		serverName: {
			type: "string",
			description:
				"The name of the terminal to use for the operation. This is used to identify the terminal instance where the server is running.",
			required: true,
		},
		lines: {
			type: "string",
			description:
				"The number of lines to retrieve from the server logs. This is only required when the commandType is 'getLogs'.",
			required: "Required when commandType is 'getLogs'",
		},
		url: {
			type: "string",
			description: "The URL of the MCP server to load the icon from.",
			required: false,
		},
	},
	capabilities: [
		"You can use server_runner tool to start, stop, restart, or get logs from a server instance while keeping it in memory for future use, it's extremely useful for running web applications locally, backend server, or any type of server instance.",
		"You can use server_runner tool to load icons for MCP servers by providing the URL of the MCP server.",
	],

	examples: [
		{
			description: "start a development server using server_runner",
			output: `<server_runner>
<commandType>start</commandType>
<commandToRun>cd frontend && npm run dev</commandToRun>
<serverName>frontend</serverName>
</server_runner>`,
		},
		{
			description: "to get logs",
			output: `<server_runner>
<commandType>getLogs</commandType>
<serverName>frontend</serverName>
<lines>50</lines>
</server_runner>`,
		},
		{
			description: "load an icon for an MCP server",
			output: `<server_runner>
<commandType>loadIcon</commandType>
<serverName>mcpServer</serverName>
<url>http://mcp-server-url/icon</url>
</server_runner>`,
		},
	],
}
