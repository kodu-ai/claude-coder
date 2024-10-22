import pWaitFor from 'p-wait-for'
import { type TerminalManager, TerminalRegistry } from '../../../../integrations/terminal/terminal-manager'
import type { ToolResponse } from '../../types'
import { formatToolResponse, getCwd } from '../../utils'
import { BaseAgentTool } from '../base-agent.tool'
import type { AgentToolOptions, AgentToolParams } from '../types'

export class DevServerTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { commandType, commandToRun, serverName } = input
		const { terminalManager } = this.koduDev

		if (!commandType || !commandToRun || !serverName) {
			await say(
				'error',
				"Missing values for required parameters 'commandType', 'commandToRun', or 'serverName'. Retrying...",
			)
			return `Error: Missing values for required parameters 'commandType', 'commandToRun', or 'serverName'. Please retry with complete response.
            An example of a good devServer tool call is:
            {
                "tool": "server_runner_tool",
                "commandType": "start" | "stop" | "restart" | "getLogs",
                "commandToRun": "npm run dev",
                "serverName": "my-dev-server"
            }
            Please try again with the correct parameters.
            `
		}

		const { response, text, images } = await ask(
			'tool',
			{
				tool: {
					tool: 'server_runner_tool',
					approvalState: 'pending',
					ts: this.ts,
					commandType,
					commandToRun,
					serverName,
				},
			},
			this.ts,
		)

		try {
			if (response === 'yesButtonTapped') {
				await this.params.updateAsk(
					'tool',
					{
						tool: {
							tool: 'server_runner_tool',
							approvalState: 'approved',
							ts: this.ts,
							commandType,
							commandToRun,
							serverName,
						},
					},
					this.ts,
				)

				let result: string
				switch (commandType) {
					case 'start':
						result = await this.startServer(terminalManager, commandToRun, serverName)
						break
					case 'stop':
						result = await this.stopServer(terminalManager, serverName)
						break
					case 'restart':
						result = await this.restartServer(terminalManager, commandToRun, serverName)
						break
					case 'getLogs':
						result = await this.getLogs(terminalManager, serverName)
						break
					default:
						result = `Unknown commandType: ${commandType}`
				}

				return formatToolResponse(result, images)
			}
			await this.params.updateAsk(
				'tool',
				{
					tool: {
						tool: 'server_runner_tool',
						approvalState: 'rejected',
						ts: this.ts,
						commandType,
						commandToRun,
						serverName,
					},
				},
				this.ts,
			)
			let errorMsg = `The user declined the request to run the dev server command: ${commandType} (${commandToRun})`
			if (text?.length || images?.length) {
				await say('user_feedback', text ?? '', images)
				if (text?.length && text.length > 1) {
					errorMsg += `\n<user_feedback>${text}</user_feedback>`
				}
			}
			return formatToolResponse(errorMsg, images)
		} catch (err) {
			this.params.updateAsk(
				'tool',
				{
					tool: {
						tool: 'server_runner_tool',
						approvalState: 'error',
						ts: this.ts,
						commandType,
						commandToRun,
						serverName,
					},
				},
				this.ts,
			)
			return formatToolResponse(
				`Error Running Command!
				Hint: Did you use correct path?
				did you use correct command ?
				did you forget to write terminal name?
				did you use cd <folder> & <command> ?
				This might help you to solve the issue.
				your current path is ${getCwd()}
				`,
				images,
			)
		}
	}

	private async startServer(terminalManager: TerminalManager, command: string, serverName: string): Promise<string> {
		if (TerminalRegistry.isDevServerRunningByName(serverName)) {
			return `Server "${serverName}" is already running.`
		}
		this.params.updateAsk(
			'tool',
			{
				tool: {
					tool: 'server_runner_tool',
					approvalState: 'loading',
					ts: this.ts,
					commandType: 'start',
					commandToRun: command,
					serverName,
				},
			},
			this.ts,
		)

		const terminalInfo = await terminalManager.getOrCreateTerminal(this.cwd, serverName)
		terminalInfo.terminal.show()

		TerminalRegistry.addDevServer(terminalInfo)

		const serverProcess = terminalManager.runCommand(terminalInfo, command, {
			autoClose: false,
		})

		let result = ''
		let urlFound = false

		// Flexible regex patterns to match URLs and ports
		const urlPattern = /(https?:\/\/[^\s]+)/i
		const portPattern = /port\s*[:=]\s*(\d+)/i

		serverProcess.on('line', (line) => {
			result += `${line}\n`
			if (!urlFound) {
				let match
				if ((match = line.match(urlPattern))) {
					TerminalRegistry.updateDevServerUrl(terminalInfo.id, match[1])
					urlFound = true
					// Continue immediately upon finding the URL
					serverProcess.continue()
				} else if ((match = line.match(portPattern))) {
					const port = match[1]
					const url = `http://localhost:${port}`
					TerminalRegistry.updateDevServerUrl(terminalInfo.id, url)
					urlFound = true
					// Continue immediately upon finding the port
					serverProcess.continue()
				}
			}
		})

		// Wait for the process to complete or for the URL to be found
		await Promise.race([serverProcess, pWaitFor(() => urlFound, { timeout: 15000 })])

		const devServer = TerminalRegistry.getDevServer(terminalInfo.id)
		const serverUrl = devServer?.url

		if (serverUrl) {
			this.params.updateAsk(
				'tool',
				{
					tool: {
						tool: 'server_runner_tool',
						approvalState: 'approved',
						ts: this.ts,
						commandType: 'start',
						commandToRun: command,
						serverName,
						output: result,
					},
				},
				this.ts,
			)
			return `Dev server "${serverName}" started successfully, check <dev_server_status> and
<dev_server_running> to find the details. The server is only viable for limited amount of time, don't take it for granted.`
		}
		// no output was found in the logs to indicate the server started successfully or the URL was found
		this.params.updateAsk(
			'tool',
			{
				tool: {
					tool: 'server_runner_tool',
					approvalState: 'error',
					ts: this.ts,
					commandType: 'start',
					commandToRun: command,
					serverName,
				},
			},
			this.ts,
		)
		return `
				ERROR!
				Failed to start server "${serverName}".
				Please check the logs for more information.
				HINT:
				did you use correct path?
				did you use correct command?
				did you forget to write terminal name?
				did you use cd <folder> & <command>?
				your current path is ${getCwd()}
				<thinking> tags to assess the situation.
				don't forget you're on ${getCwd()} ask yourself did i use correct path?
				is the server folder located at ${getCwd()} or is it in a nested folder? if so, did you use cd <folder> & <command>?
				`
	}

	private async stopServer(terminalManager: TerminalManager, serverName: string): Promise<string> {
		const devServer = TerminalRegistry.getDevServerByName(serverName)
		if (!devServer) {
			return `No server named "${serverName}" is currently running.`
		}

		devServer.terminalInfo.terminal.show()

		// Kill the process and clear the terminal

		TerminalRegistry.clearDevServer(devServer.terminalInfo.id)

		return `Server "${serverName}" stopped successfully.`
	}

	private async restartServer(
		terminalManager: TerminalManager,
		command: string,
		serverName: string,
	): Promise<string> {
		this.params.updateAsk(
			'tool',
			{
				tool: {
					tool: 'server_runner_tool',
					approvalState: 'loading',
					ts: this.ts,
					commandType: 'restart',
					commandToRun: command,
					serverName,
				},
			},
			this.ts,
		)
		const stopResult = await this.stopServer(terminalManager, serverName)
		const startResult = await this.startServer(terminalManager, command, serverName)
		this.params.updateAsk(
			'tool',
			{
				tool: {
					tool: 'server_runner_tool',
					approvalState: 'approved',
					ts: this.ts,
					commandType: 'restart',
					commandToRun: command,
					serverName,
				},
			},
			this.ts,
		)
		return `${stopResult}\n${startResult}`
	}

	private async getLogs(terminalManager: TerminalManager, serverName: string): Promise<string> {
		const devServer = TerminalRegistry.getDevServerByName(serverName)
		if (!devServer) {
			return `No server named "${serverName}" is currently running. No logs available.`
		}

		const logs = terminalManager.getFullOutput(devServer.terminalInfo.id)

		this.params.updateAsk(
			'tool',
			{
				tool: {
					tool: 'server_runner_tool',
					approvalState: 'approved',
					ts: this.ts,
					commandType: 'getLogs',
					commandToRun: this.paramsInput.commandToRun ?? '',
					serverName,
					output: logs,
				},
			},
			this.ts,
		)

		return `Server Logs for "${serverName}":\n${logs}`
	}
}
