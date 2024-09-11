import { execa, ExecaError, ResultPromise } from "execa"
import { serializeError } from "serialize-error"
import treeKill from "tree-kill"
import { ToolResponse } from "../types"
import { COMMAND_OUTPUT_DELAY } from "../constants"
import { formatGenericToolFeedback, formatToolResponse, getPotentiallyRelevantDetails } from "../utils"
import delay from "delay"
import { COMMAND_STDIN_STRING } from "../../../shared/combineCommandSequences"
import { findLastIndex } from "../../../utils"
import { AgentToolOptions, AgentToolParams } from "./types"
import { BaseAgentTool } from "./base-agent.tool"

export class ExecuteCommandTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
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
}
