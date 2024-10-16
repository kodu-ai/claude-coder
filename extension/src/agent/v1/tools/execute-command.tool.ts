import Anthropic from "@anthropic-ai/sdk"
import delay from "delay"
import { ExecaError, ResultPromise, execa } from "execa"
import { serializeError } from "serialize-error"
import treeKill from "tree-kill"
import { AdvancedTerminalManager } from "../../../integrations/terminal"
import { COMMAND_STDIN_STRING } from "../../../shared/combineCommandSequences"
import { findLastIndex } from "../../../utils"
import { COMMAND_OUTPUT_DELAY } from "../constants"
import { ToolResponse } from "../types"
import { formatGenericToolFeedback, formatToolResponse, getCwd, getPotentiallyRelevantDetails } from "../utils"
import { BaseAgentTool } from "./base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "./types"

export class ExecuteCommandTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
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
		return this.executeShellTerminal(command)
		// if (this.koduDev.terminalManager instanceof AdvancedTerminalManager) {
		// }
		// return this.executeExeca()
	}

	private async executeShellTerminal(command: string): Promise<ToolResponse> {
		const { terminalManager } = this.koduDev
		const { ask, say, returnEmptyStringOnSuccess } = this.params
		const cwd = getCwd()
		const { response, text, images } = await ask("command", command)
		if (response !== "yesButtonTapped" && !this.alwaysAllowWriteOnly) {
			if (response === "messageResponse") {
				await say("user_feedback", text, images)
				return this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images)
			}
			return await this.formatToolDenied()
		}

		try {
			const postToWebview = this.koduDev.providerRef.deref()!["view"]?.webview.postMessage

			console.log(`Creating terminal: ${typeof terminalManager} `)
			// const terminalInfo = await terminalManager.getOrCreateTerminal(this.cwd)
			console.log("Terminal created")

			await say("terminal_view", command)
			// terminalInfo.terminal.show() // weird visual bug when creating new terminals (even manually) where there's an empty space at the top.
			// const process = await terminalManager.runCommand(command, this.cwd, postToWebview)
			// const result = await terminalManager.awaitCommand(process)

			return "The command execution succeeded."

			// return `The command execution ${result.exitCode === 0 ? "succeeded" : "failed"}.
			// ${result.stdout?.toString() ?? result.stderr?.toString() ?? ""}`

			// let userFeedback: { text?: string; images?: string[] } | undefined
			// let didContinue = false
			// const sendCommandOutput = async (line: string): Promise<void> => {
			// 	try {
			// 		const { response, text, images } = await ask("command_output", line)
			// 		if (response === "yesButtonTapped") {
			// 			// proceed while running
			// 		} else {
			// 			userFeedback = { text, images }
			// 		}
			// 		didContinue = true
			// 		process.continue() // continue past the await
			// 	} catch {
			// 		// This can only happen if this ask promise was ignored, so ignore this error
			// 	}
			// }

			// let result = ""
			// process.on("line", (line) => {
			// 	result += line + "\n"
			// 	if (!didContinue) {
			// 		sendCommandOutput(line)
			// 	} else {
			// 		say("command_output", line)
			// 	}
			// })

			// let completed = false
			// process.once("completed", () => {
			// 	completed = true
			// })

			// process.once("no_shell_integration", async () => {
			// 	await say("shell_integration_warning")
			// })

			// await process

			// // Wait for a short delay to ensure all messages are sent to the webview
			// // This delay allows time for non-awaited promises to be created and
			// // for their associated messages to be sent to the webview, maintaining
			// // the correct order of messages (although the webview is smart about
			// // grouping command_output messages despite any gaps anyways)
			// await delay(50)

			// result = result.trim()

			// if (userFeedback) {
			// 	await say("user_feedback", userFeedback.text, userFeedback.images)
			// 	return this.formatToolResponseWithImages(
			// 		await this.formatToolResult(
			// 			`Command executed.${
			// 				result.length > 0 ? `\nOutput:\n${result}` : ""
			// 			}\n\nThe user provided the following feedback:\n<feedback>\n${userFeedback.text}\n</feedback>`
			// 		),
			// 		userFeedback.images
			// 	)
			// }

			// // for attemptCompletion, we don't want to return the command output
			// if (returnEmptyStringOnSuccess) {
			// 	return this.formatToolResponseWithImages(await this.formatToolResult(""), [])
			// }
			// if (completed) {
			// 	return await this.formatToolResult(
			// 		`Command executed.${result.length > 0 ? `\nOutput:\n${result}` : ""}`
			// 	)
			// } else {
			// 	return await this.formatToolResult(
			// 		`Command is still running in the user's terminal.${
			// 			result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
			// 		}\n\nYou will be updated on the terminal status and new output in the future.`
			// 	)
			// }
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

		let response = "yesButtonTapped"
		if (!this.alwaysAllowWriteOnly) {
			const result = await ask("command", command)
			response = result.response
			if (response === "messageResponse") {
				await say("user_feedback", result.text, result.images)
				return formatToolResponse(formatGenericToolFeedback(result.text), result.images)
			}
		} else {
			ask("command", command)
		}

		if (response !== "yesButtonTapped") {
			return "The user denied this operation."
		}

		let userFeedback: { text?: string; images?: string[] } | undefined
		const sendCommandOutput = async (subprocess: ResultPromise, line: string): Promise<void> => {
			try {
				if (this.alwaysAllowWriteOnly) {
					await say("command_output", line)
				} else {
					const { response, text, images } = await ask("command_output", line)
					const isStdin = (text ?? "").startsWith(COMMAND_STDIN_STRING)
					if (response === "yesButtonTapped") {
						if (subprocess.pid) {
							treeKill(subprocess.pid, "SIGINT")
						}
					} else {
						if (isStdin) {
							const stdin = text?.slice(COMMAND_STDIN_STRING.length) ?? ""

							// replace last commandoutput with + stdin
							const lastCommandOutput = findLastIndex(
								this.koduDev.getStateManager().state.claudeMessages,
								(m) => m.ask === "command_output"
							)
							if (lastCommandOutput !== -1) {
								this.koduDev.getStateManager().state.claudeMessages[lastCommandOutput].text += stdin
							}

							// if the user sent some input, we send it to the command stdin
							// add newline as cli programs expect a newline after each input
							// (stdin needs to be set to `pipe` to send input to the command, execa does this by default when using template literals - other options are inherit (from parent process stdin) or null (no stdin))
							subprocess.stdin?.write(stdin + "\n")
							// Recurse with an empty string to continue listening for more input
							sendCommandOutput(subprocess, "") // empty strings are effectively ignored by the webview, this is done solely to relinquish control over the exit command button
						} else {
							userFeedback = { text, images }
							if (subprocess.pid) {
								treeKill(subprocess.pid, "SIGINT")
							}
						}
					}
				}
			} catch {
				// Ignore errors from ignored ask promises
			}
		}

		try {
			let result = ""
			const subprocess = execa({ shell: true, cwd: this.cwd })`${command}`
			this.setRunningProcessId(subprocess.pid!)

			const timeoutPromise = new Promise<string>((_, reject) => {
				setTimeout(() => {
					reject(new Error("Command execution timed out after 90 seconds"))
				}, 90000) // 90 seconds timeout
			})

			subprocess.stdout?.on("data", (data) => {
				if (data) {
					const output = data.toString()
					sendCommandOutput(subprocess, output)
					result += output
				}
			})

			try {
				await Promise.race([subprocess, timeoutPromise])
				// Check if the output exceeds 15k characters and summarize it if necessary
				if (result.length > 15_000) {
					try {
						say("info", `Command output exceeds 15 000 characters. Making a summary...`)
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

				if (subprocess.exitCode !== 0) {
					throw new Error(`Command failed with exit code ${subprocess.exitCode}`)
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
