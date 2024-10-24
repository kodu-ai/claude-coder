import { ToolResponse } from "../../types"
import { formatToolResponse, getCwd } from "../../utils"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"
import { TerminalManager, TerminalRegistry } from "../../../../integrations/terminal/terminal-manager"
import pWaitFor from "p-wait-for"
import delay from "delay"
import { ChatTool, ServerRunnerTool } from "../../../../shared/new-tools"

interface UpdateAskParams {
	tool: string
	approvalState: string
	ts: number
	commandType: string
	commandToRun?: string
	serverName: string
	output?: string
}

export class DevServerTool extends BaseAgentTool {
	protected params: AgentToolParams
	private static readonly ERROR_PATTERNS = [
		/error/i,
		/EADDRINUSE/i,
		/EACCES/i,
		/cannot find module/i,
		/command not found/i,
		/failed to compile/i,
		/syntax error/i,
		/module not found/i,
	]

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	private async updateToolState(
		approvalState: NonNullable<ChatTool["approvalState"]>,
		commandType: ServerRunnerTool["commandType"],
		commandToRun: string | undefined,
		serverName: string,
		output?: string
	) {
		const updateParams: ServerRunnerTool & ChatTool = {
			tool: "server_runner_tool",
			approvalState,
			ts: this.ts,
			commandType,
			commandToRun,
			serverName,
			output,
		}

		await this.params.updateAsk("tool", { tool: updateParams }, this.ts)
	}

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { commandType, commandToRun, serverName } = input
		const { terminalManager } = this.koduDev

		if (!commandType || !serverName) {
			await say("error", "Missing required parameters 'commandType' or 'serverName'")
			return `Error: Missing required parameters. Please provide all required parameters:
            - commandType: ${commandType ? "✓" : "✗"}
            - serverName: ${serverName ? "✓" : "✗"}
            Example:
            <server_runner_tool>
                <commandType>start</commandType>
                <commandToRun>npm run dev</commandToRun>
                <serverName>my-dev-server</serverName>
            </server_runner_tool>`
		}

		if ((commandType === "start" || commandType === "restart") && !commandToRun) {
			await say("error", "Missing required parameter 'commandToRun' for start/restart operation")
			return `Error: Missing 'commandToRun' parameter for ${commandType} operation.
            Example:
            <server_runner_tool>
                <commandType>${commandType}</commandType>
                <commandToRun>npm run dev</commandToRun>
                <serverName>${serverName}</serverName>
            </server_runner_tool>`
		}

		const { response, text, images } = await ask(
			"tool",
			{
				tool: {
					tool: "server_runner_tool",
					approvalState: "pending",
					ts: this.ts,
					commandType,
					commandToRun,
					serverName,
				},
			},
			this.ts
		)

		try {
			if (response === "yesButtonTapped") {
				await this.updateToolState("approved", commandType, commandToRun, serverName)

				let result: string
				switch (commandType) {
					case "start":
						result = await this.startServer(terminalManager, commandToRun!, serverName)
						break
					case "stop":
						result = await this.stopServer(serverName)
						break
					case "restart":
						result = await this.restartServer(terminalManager, commandToRun!, serverName)
						break
					case "getLogs":
						result = await this.getLogs(serverName)
						break
					default:
						result = `Unknown commandType: ${commandType}`
				}

				return formatToolResponse(result, images)
			} else {
				await this.updateToolState("rejected", commandType, commandToRun, serverName)
				const errorMsg = `Request rejected: ${commandType} operation for server "${serverName}"${
					commandToRun ? ` with command "${commandToRun}"` : ""
				}`
				if (text) {
					// await say("user_feedback", text, images)
					await this.params.updateAsk(
						"tool",
						{
							tool: {
								tool: "server_runner_tool",
								approvalState: "rejected",
								ts: this.ts,
								commandType,
								commandToRun,
								serverName,
								// output: text,
								userFeedback: text,
							},
						},
						this.ts
					)
				}
				return formatToolResponse(
					`${errorMsg}${text ? `\n<user_feedback>${text}</user_feedback>` : ""}`,
					images
				)
			}
		} catch (err) {
			const devServer = TerminalRegistry.getDevServerByName(serverName)
			const logs = devServer?.logs || []
			await this.updateToolState("error", commandType, commandToRun, serverName, logs.join("\n"))

			const errorAnalysis = this.analyzeError(err.message, logs)
			TerminalRegistry.updateDevServerStatus(devServer?.terminalInfo.id || -1, "error", errorAnalysis.message)

			return formatToolResponse(
				`Error executing ${commandType} operation for server "${serverName}":
                ${errorAnalysis.message}
                
                Server Logs:
                <error_logs>
                ${logs.join("\n")}
                </error_logs>
                
                ${errorAnalysis.troubleshooting}
                `,
				images
			)
		}
	}

	private analyzeError(errorMessage: string, logs: string[]): { message: string; troubleshooting: string } {
		const lastLogs = logs.slice(-10).join("\n")

		// Check for common error patterns
		if (/EADDRINUSE/.test(errorMessage) || /EADDRINUSE/.test(lastLogs)) {
			return {
				message: "Port is already in use",
				troubleshooting: `Troubleshooting Tips:
                - Try stopping any other running servers
                - Use a different port in your configuration
                - Check if another process is using the same port
                - Run 'lsof -i' to see which process is using the port`,
			}
		}

		if (
			/cannot find module|module not found/i.test(errorMessage) ||
			/cannot find module|module not found/i.test(lastLogs)
		) {
			return {
				message: "Missing dependencies",
				troubleshooting: `Troubleshooting Tips:
                - Run 'npm install' to install missing dependencies
                - Check if the package is listed in package.json
                - Verify node_modules directory exists
                - Try deleting node_modules and package-lock.json, then run 'npm install'`,
			}
		}

		if (/command not found/i.test(errorMessage) || /command not found/i.test(lastLogs)) {
			return {
				message: "Command not found",
				troubleshooting: `Troubleshooting Tips:
                - Verify the command exists in package.json scripts
                - Check if the required CLI tools are installed globally
                - Ensure you're in the correct directory
                - Current working directory: ${getCwd()}`,
			}
		}

		if (/failed to compile/i.test(errorMessage) || /failed to compile/i.test(lastLogs)) {
			return {
				message: "Compilation error",
				troubleshooting: `Troubleshooting Tips:
                - Check the syntax in your source files
                - Look for missing imports or exports
                - Verify your configuration files
                - Check for type errors if using TypeScript`,
			}
		}

		// Generic error
		return {
			message: errorMessage,
			troubleshooting: `Troubleshooting Tips:
            - Current working directory: ${getCwd()}
            - For nested folders, use: cd <folder> && <command>
            - Check if all dependencies are installed
            - Verify the command syntax
            - Ensure the port is not in use
            - Check the logs above for specific error messages`,
		}
	}

	private async startServer(terminalManager: TerminalManager, command: string, serverName: string): Promise<string> {
		if (TerminalRegistry.isDevServerRunningByName(serverName)) {
			return `Server "${serverName}" is already running.`
		}

		await this.updateToolState("loading", "start", command, serverName)

		const terminalInfo = await terminalManager.getOrCreateTerminal(this.cwd, serverName)
		terminalInfo.terminal.show()
		TerminalRegistry.addDevServer(terminalInfo)
		TerminalRegistry.updateDevServerStatus(terminalInfo.id, "starting")

		const serverProcess = terminalManager.runCommand(terminalInfo, command, { autoClose: false })

		const startData = {
			urlFound: false,
			hasError: false,
			errorMessage: "",
			logs: [] as string[],
			timeout: false,
		}

		serverProcess.on("line", (line) => {
			startData.logs.push(line)
			this.processServerOutput(line, startData, terminalInfo.id)
		})

		serverProcess.on("no_shell_integration", () => {
			this.params.say("shell_integration_warning")
			throw new Error(
				"Shell integration not available, to run commands in the terminal the user must enable shell integration. Otherwise, commands will not run."
			)
		})

		try {
			await Promise.race([
				serverProcess,
				pWaitFor(() => startData.urlFound || startData.hasError, { timeout: 15_000 }).catch(() => {
					startData.timeout = true
					throw new Error("Server start timeout")
				}),
				delay(15_000).then(() => {
					startData.timeout = true
					throw new Error("Server start timeout")
				}),
			])

			const devServer = TerminalRegistry.getDevServer(terminalInfo.id)
			const serverUrl = devServer?.url
			const logs = devServer?.logs || []

			if (startData.hasError) {
				TerminalRegistry.updateDevServerStatus(terminalInfo.id, "error", startData.errorMessage)
				await this.updateToolState("error", "start", command, serverName, logs.join("\n"))
				return `Failed to start server "${serverName}":
                ${startData.errorMessage}
                
                <error_logs>
                ${logs.join("\n")}
                </error_logs>`
			}

			if (serverUrl) {
				TerminalRegistry.updateDevServerStatus(terminalInfo.id, "running")
				await this.updateToolState("approved", "start", command, serverName, logs.join("\n"))
				return `Server "${serverName}" started successfully at ${serverUrl}
                
                <server_logs>
                ${logs.join("\n")}
                </server_logs>`
			}

			TerminalRegistry.updateDevServerStatus(terminalInfo.id, "error", "No URL detected")
			await this.updateToolState("error", "start", command, serverName, logs.join("\n"))
			return `Server "${serverName}" start attempt timed out. No URL detected.
            
            <server_logs>
            ${logs.join("\n")}
            </server_logs>`
		} catch (error) {
			const devServer = TerminalRegistry.getDevServer(terminalInfo.id)
			const logs = devServer?.logs || []

			if (startData.timeout) {
				TerminalRegistry.updateDevServerStatus(terminalInfo.id, "error", "Server start timeout")
			} else {
				TerminalRegistry.updateDevServerStatus(terminalInfo.id, "error", error.message)
			}

			await this.updateToolState("error", "start", command, serverName, logs.join("\n"))
			throw error
		}
	}

	private processServerOutput(line: string, startData: any, terminalId: number) {
		// Check for errors first
		if (DevServerTool.ERROR_PATTERNS.some((pattern) => pattern.test(line))) {
			startData.hasError = true
			startData.errorMessage = line
			return
		}

		// Check for URL/port
		if (!startData.urlFound) {
			const urlMatch = line.match(/(https?:\/\/[^\s]+)/i)
			if (urlMatch) {
				TerminalRegistry.updateDevServerUrl(terminalId, urlMatch[1])
				startData.urlFound = true
				return
			}

			const portMatch = line.match(/(?:port|listening)[^\d]*(\d+)/i)
			if (portMatch) {
				const url = `http://localhost:${portMatch[1]}`
				TerminalRegistry.updateDevServerUrl(terminalId, url)
				startData.urlFound = true
			}
		}
	}

	private async stopServer(serverName: string): Promise<string> {
		const devServer = TerminalRegistry.getDevServerByName(serverName)
		if (!devServer) {
			return `No server named "${serverName}" is currently running.`
		}

		const logs = devServer.logs || []
		devServer.terminalInfo.terminal.show()
		TerminalRegistry.updateDevServerStatus(devServer.terminalInfo.id, "stopped")
		TerminalRegistry.clearDevServer(devServer.terminalInfo.id)

		await this.updateToolState("approved", "stop", undefined, serverName, logs.join("\n"))

		return `Server "${serverName}" stopped successfully.
        
        <server_logs>
        ${logs.join("\n")}
        </server_logs>`
	}

	private async restartServer(
		terminalManager: TerminalManager,
		command: string,
		serverName: string
	): Promise<string> {
		await this.updateToolState("loading", "restart", command, serverName)

		const stopResult = await this.stopServer(serverName)
		await delay(2000) // Ensure clean shutdown
		const startResult = await this.startServer(terminalManager, command, serverName)

		return `${stopResult}\n${startResult}`
	}

	private async getLogs(serverName: string): Promise<string> {
		const devServer = TerminalRegistry.getDevServerByName(serverName)
		if (!devServer) {
			return `No server named "${serverName}" is currently running. No logs available.`
		}

		const logs = devServer.logs || []
		await this.updateToolState("approved", "getLogs", undefined, serverName, logs.join("\n"))

		return `Server Logs for "${serverName}":
        
        <server_logs>
        ${logs.join("\n")}
        </server_logs>`
	}
}
