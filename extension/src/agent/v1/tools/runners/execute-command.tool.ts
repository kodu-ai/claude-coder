import Anthropic from "@anthropic-ai/sdk"
import delay from "delay"
import { ExecaError, ResultPromise, execa } from "execa"
import { serializeError } from "serialize-error"
import treeKill from "tree-kill"
import { AdvancedTerminalManager } from "../../../../integrations/terminal"
import { COMMAND_STDIN_STRING } from "../../../../shared/combineCommandSequences"
import { findLastIndex } from "../../../../utils"
import { COMMAND_OUTPUT_DELAY } from "../../constants"
import { ToolResponse } from "../../types"
import { formatGenericToolFeedback, formatToolResponse, getCwd, getPotentiallyRelevantDetails } from "../../utils"
import { BaseAgentTool } from "../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../types"
import { ExecaTerminalManager } from "../../../../integrations/terminal/execa-terminal-manager"

export class ExecuteCommandTool extends BaseAgentTool {
	protected params: AgentToolParams
	private execaTerminalManager: ExecaTerminalManager

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.execaTerminalManager = new ExecaTerminalManager()
	}

	override async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { command } = input
		if (command === undefined || command === "") {
			await say(
				"error",
				"Claude tried to use execute_command without value for required parameter 'command'. Retrying..."
			)
			return `Error: Missing value for required parameter 'command'. Please retry with complete response.
			an example of a good executeCommand tool call is:
			{
				"tool": "execute_command",
				"command": "command to execute"
			}
			Please try again with the correct command, you are not allowed to execute commands without a command.
			`
		}
		// if (this.koduDev.terminalManager instanceof AdvancedTerminalManager) {
		// 	return this.executeShellTerminal(command)
		// }
		return this.executeExeca()
	}

	private async executeShellTerminal(command: string): Promise<ToolResponse> {
		const { terminalManager } = this.koduDev
		if (!(terminalManager instanceof AdvancedTerminalManager)) {
			throw new Error("AdvancedTerminalManager is not available")
		}
		const { ask, say, returnEmptyStringOnSuccess } = this.params
		const cwd = getCwd()

		const { response, text, images } = await ask(
			"tool",
			{
				tool: {
					tool: "execute_command",
					command,
					approvalState: "pending",
					ts: this.ts,
				},
			},
			this.ts
		)
		if (response !== "yesButtonTapped") {
			ask(
				"tool",
				{
					tool: {
						tool: "execute_command",
						command,
						approvalState: "rejected",
						ts: this.ts,
					},
				},
				this.ts
			)
			if (response === "messageResponse") {
				await say("user_feedback", text, images)
				return this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images)
			}
			return await this.formatToolDenied()
		}
		ask(
			"tool",
			{
				tool: {
					tool: "execute_command",
					command,
					approvalState: "loading",
					ts: this.ts,
				},
			},
			this.ts
		)

		try {
			console.log(`Creating terminal: ${typeof terminalManager} `)
			const terminalInfo = await terminalManager.getOrCreateTerminal(this.cwd)
			console.log("Terminal created")
			terminalInfo.terminal.show() // weird visual bug when creating new terminals (even manually) where there's an empty space at the top.
			const process = terminalManager.runCommand(terminalInfo, command)

			let userFeedback: { text?: string; images?: string[] } | undefined
			let didContinue = false
			const sendCommandOutput = async (line: string): Promise<void> => {
				try {
					const { response, text, images } = await ask(
						"tool",
						{
							tool: {
								tool: "execute_command",
								command,
								output: line,
								approvalState: "approved",
								ts: this.ts,
							},
						},
						this.ts
					)
					if (response === "yesButtonTapped") {
						// proceed while running
					} else {
						userFeedback = { text, images }
					}
					didContinue = true
					process.continue() // continue past the await
				} catch {
					// This can only happen if this ask promise was ignored, so ignore this error
				}
			}

			let result = ""
			process.on("line", (line) => {
				result += line + "\n"
				// if it starts with \n, remove it
				if (result.startsWith("\n")) {
					result = result.slice(1)
				}
				if (!didContinue) {
					sendCommandOutput(result)
				} else {
					ask(
						"tool",
						{
							tool: {
								tool: "execute_command",
								command,
								output: result,
								approvalState: "approved",
								ts: this.ts,
							},
						},
						this.ts
					)
				}
			})

			let completed = false
			process.once("completed", () => {
				completed = true
			})

			process.once("no_shell_integration", async () => {
				await say("shell_integration_warning")
			})

			await process

			// Wait for a short delay to ensure all messages are sent to the webview
			// This delay allows time for non-awaited promises to be created and
			// for their associated messages to be sent to the webview, maintaining
			// the correct order of messages (although the webview is smart about
			// grouping command_output messages despite any gaps anyways)
			await delay(50)

			result = result.trim()

			if (userFeedback) {
				await say("user_feedback", userFeedback.text, userFeedback.images)
				return this.formatToolResponseWithImages(
					await this.formatToolResult(
						`Command executed.${
							result.length > 0 ? `\nOutput:\n${result}` : ""
						}\n\nThe user provided the following feedback:\n<feedback>\n${userFeedback.text}\n</feedback>`
					),
					userFeedback.images
				)
			}

			// for attemptCompletion, we don't want to return the command output
			if (returnEmptyStringOnSuccess) {
				return this.formatToolResponseWithImages(await this.formatToolResult(""), [])
			}
			if (completed) {
				return await this.formatToolResult(
					`Command executed.${result.length > 0 ? `\nOutput:\n${result}` : ""}`
				)
			} else {
				return await this.formatToolResult(
					`Command is still running in the user's terminal.${
						result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
					}\n\nYou will be updated on the terminal status and new output in the future.`
				)
			}
		} catch (error) {
			let errorMessage = error.message || JSON.stringify(serializeError(error), null, 2)
			const errorString = `Error executing command:\n${errorMessage}`
			await say("error", `Error executing command:\n${errorMessage}`)
			return await this.formatToolError(errorString)
		}
	}

	async executeExeca(): Promise<ToolResponse> {
		const { input, ask, say, returnEmptyStringOnSuccess } = this.params
		const { command } = input

		if (command === undefined) {
			await say(
				"error",
				"Claude tried to use execute_command without value for required parameter 'command'. Retrying..."
			)
			return `Error: Missing value for required parameter 'command'. Please retry with complete response.
					an example of a good executeCommand tool call is:
					{
						"tool": "execute_command",
						"command": "command to execute"
					}
					Please try again with the correct command, you are not allowed to execute commands without a command.
					`
		}

		const result = await ask(
			"tool",
			{
				tool: {
					tool: "execute_command",
					command,
					approvalState: "pending",
					ts: this.ts,
				},
			},
			this.ts
		)
		const response = result.response
		if (response === "messageResponse") {
			await say("user_feedback", result.text, result.images)
			return formatToolResponse(formatGenericToolFeedback(result.text), result.images)
		}

		if (response !== "yesButtonTapped") {
			return "The user denied this operation."
		}

		let userFeedback: { text?: string; images?: string[] } | undefined

		try {
			let result = ""
			let didError = false

			const callbackFunction = (event: "error" | "exit" | "response", commandId: number, data: string) => {
				if (event === "response") {
					result += data
				} else if (event === "exit") {
					didError = true
				}

				this.koduDev.providerRef.deref()!["view"]?.webview.postMessage({
					type: "commandExecutionResponse",
					status: event,
					payload: data,
					commandId: commandId.toString(),
				})
			}

			const commandId = await this.execaTerminalManager.runCommand(command, this.cwd, callbackFunction)
			this.setRunningProcessId(commandId)

			const timeoutPromise = new Promise<string>((_, reject) => {
				setTimeout(() => {
					reject(new Error("Command execution timed out after 90 seconds"))
				}, 90000) // 90 seconds timeout
			})

			try {
				await Promise.race([this.execaTerminalManager.awaitCommand(commandId), timeoutPromise])
				// Check if the output exceeds 15k characters and summarize it if necessary
				if (result.length > 30_000) {
					try {
						say("info", `Command output exceeds 30 000 characters. Making a summary...`)
						const summary = await this.koduDev
							.getApiManager()
							.getApi()
							?.sendSummarizeRequest?.(result, command)
						if (!summary || !summary.result) {
							return "Summarization failed."
						}
						return `Summarized command output:\n${response.length}`
					} catch (err) {
						return `Failed to summarize the command output: ${err}`
					}
				}

				if (didError) {
					throw new Error(`Command failed`)
				}
			} catch (e) {
				if ((e as ExecaError).signal === "SIGINT") {
					await say("command_output", `\nUser exited command...`)
					result += `\n====\nUser terminated command process via SIGINT. This is not an error. Please continue with your task, but keep in mind that the command is no longer running. For example, if this command was used to start a server for a react app, the server is no longer running and you cannot open a browser to view it anymore.`
				} else if ((e as Error).message.includes("timed out")) {
					await say("command_output", `\nCommand execution timed out after 90 seconds`)
					result += `\n====\nCommand execution timed out after 90 seconds. Please review the partial output and consider breaking down the command into smaller steps or optimizing the operation.`
				} else {
					throw e
				}
			}

			await delay(COMMAND_OUTPUT_DELAY)
			this.setRunningProcessId(undefined)

			if (userFeedback) {
				await say("user_feedback", userFeedback.text, userFeedback.images)
				return formatToolResponse(
					`Command Output:\n${result}\n\nThe user interrupted the command and provided the following feedback:\n<feedback>\n${
						userFeedback.text
					}\n</feedback>\n\n${await getPotentiallyRelevantDetails()}`,
					userFeedback.images
				)
			}

			if (returnEmptyStringOnSuccess) {
				return ""
			}

			return `Command Output:\n${result}`
		} catch (e) {
			const error = e as any
			let errorMessage = error.message || JSON.stringify(serializeError(error), null, 2)
			const errorString = `Error executing command:\n${errorMessage}`
			await say("error", `Error executing command:\n${errorMessage}`)

			this.setRunningProcessId(undefined)
			return errorString
		}
	}

	private formatImagesIntoBlocks(images?: string[]): Anthropic.ImageBlockParam[] {
		return images
			? images.map((dataUrl) => {
					// data:image/png;base64,base64string
					const [rest, base64] = dataUrl.split(",")
					const mimeType = rest.split(":")[1].split(";")[0]
					return {
						type: "image",
						source: { type: "base64", media_type: mimeType, data: base64 },
					} as Anthropic.ImageBlockParam
			  })
			: []
	}

	private formatIntoToolResponse(text: string, images?: string[]): ToolResponse {
		if (images && images.length > 0) {
			const textBlock: Anthropic.TextBlockParam = { type: "text", text }
			const imageBlocks: Anthropic.ImageBlockParam[] = this.formatImagesIntoBlocks(images)
			// Placing images after text leads to better results
			return [textBlock, ...imageBlocks]
		} else {
			return text
		}
	}
}
