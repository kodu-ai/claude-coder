import Anthropic from "@anthropic-ai/sdk"
import delay from "delay"
import { ExecaError } from "execa"
import { serializeError } from "serialize-error"
import { AdvancedTerminalManager } from "../../../../integrations/terminal"
import { COMMAND_OUTPUT_DELAY } from "../../constants"
import { ToolResponse } from "../../types"
import { formatGenericToolFeedback, formatToolResponse, getCwd, getPotentiallyRelevantDetails } from "../../utils"
import { BaseAgentTool } from "../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../types"
import { ExecaTerminalManager } from "../../../../integrations/terminal/execa-terminal-manager"
import { WebviewMessage } from "../../../../shared/WebviewMessage"
import { ChatTool } from "../../../../shared/new-tools"

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
		return this.executeShellTerminal(command)
		// }
		// return this.executeExeca()
	}

	private async executeShellTerminal(command: string): Promise<ToolResponse> {
		const { terminalManager } = this.koduDev
		if (!(terminalManager instanceof AdvancedTerminalManager)) {
			throw new Error("AdvancedTerminalManager is not available")
		}
		const { ask, updateAsk, say, returnEmptyStringOnSuccess } = this.params
		const cwd = getCwd()

		const { response, text, images } = await ask(
			"tool",
			{
				tool: {
					tool: "execute_command",
					command,
					approvalState: "pending",
					ts: this.ts,
					isSubMsg: this.params.isSubMsg,
				},
			},
			this.ts
		)
		if (response !== "yesButtonTapped") {
			updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						command,
						approvalState: "rejected",
						ts: this.ts,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)
			if (response === "messageResponse") {
				if (!this.alwaysAllowWriteOnly) {
					await say("user_feedback", text, images)
				}
				return this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images)
			}
			return await this.formatToolDenied()
		}
		updateAsk(
			"tool",
			{
				tool: {
					tool: "execute_command",
					command,
					approvalState: "loading",
					ts: this.ts,
					isSubMsg: this.params.isSubMsg,
				},
			},
			this.ts
		)

		try {
			console.log(`Creating terminal: ${typeof terminalManager} `)
			const terminalInfo = await terminalManager.getOrCreateTerminal(this.cwd)
			console.log("Terminal created")
			terminalInfo.terminal.show() // weird visual bug when creating new terminals (even manually) where there's an empty space at the top.
			const process = terminalManager.runCommand(terminalInfo, command, {
				autoClose: this.koduDev.getStateManager().autoCloseTerminal,
			})
			await delay(100)

			let userFeedback: { text?: string; images?: string[] } | undefined
			let didContinue = false
			let earlyExit: "approved" | "rejected" | "pending" = "pending"

			const sendCommandOutput = async (line: string): Promise<void> => {
				try {
					if (this.alwaysAllowWriteOnly) {
						/**
						 * let it run for a bit before ending
						 */
						await delay(100)
					}
					updateAsk(
						"tool",
						{
							tool: {
								tool: "execute_command",
								command,
								output: line,
								approvalState: "loading",
								ts: this.ts,
								earlyExit,
								isSubMsg: this.params.isSubMsg,
							},
						},
						this.ts
					)
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
					updateAsk(
						"tool",
						{
							tool: {
								tool: "execute_command",
								command,
								output: result,
								approvalState: "loading",
								ts: this.ts,
								earlyExit,
								isSubMsg: this.params.isSubMsg,
							},
						},
						this.ts
					)
				}
			})

			let completed = false
			process.once("completed", () => {
				earlyExit = "approved"
				completed = true
				terminalManager.closeTerminal(terminalInfo.id)
			})

			process.once("no_shell_integration", async () => {
				await say("shell_integration_warning")
			})

			const earlyExitPromise = ask(
				"tool",
				{
					tool: {
						tool: "execute_command",
						command,
						approvalState: "loading",
						ts: this.ts,
						earlyExit,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)
				.then((res) => {
					console.log(`Command contiune result`)
					const { text, images, response } = res

					if (response === "yesButtonTapped") {
						didContinue = true
						earlyExit = "approved"
						// proceed while running
					} else {
						if (response === "messageResponse") {
							didContinue = true
							earlyExit = "approved"
							userFeedback = { text, images }
						} else {
							earlyExit = "rejected"
						}
					}
					if (didContinue) {
						process.continue()
					}
					userFeedback = { text, images }
				})
				.catch()

			await Promise.race([earlyExitPromise, process])

			// Wait for a short delay to ensure all messages are sent to the webview
			// This delay allows time for non-awaited promises to be created and
			// for their associated messages to be sent to the webview, maintaining
			// the correct order of messages (although the webview is smart about
			// grouping command_output messages despite any gaps anyways)
			await delay(50)

			result = result.trim()
			await updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						command,
						output: result,
						approvalState: "approved",
						ts: this.ts,
						earlyExit,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)
			let toolRes = "The command has been executed."
			// @ts-expect-error type is broken but it is reachable
			if (earlyExit === "approved") {
				toolRes = "User chose to run the command in the background"
			}
			if ((userFeedback?.text !== "undefined" && userFeedback?.text?.length) || userFeedback?.images?.length) {
				toolRes += `\n\nUser feedback:\n<feedback>\n${userFeedback.text}\n</feedback>`
				await say("user_feedback", userFeedback.text, userFeedback.images)
			}

			// for attemptCompletion, we don't want to return the command output
			if (returnEmptyStringOnSuccess) {
				return this.formatToolResponseWithImages(await this.formatToolResult(""), [])
			}
			if (completed) {
				toolRes += `\n\nOutput:\n<output>\n${result ?? "No output"}\n</output>`
			} else {
				toolRes += `\n\nThe command is still running in the user's terminal. You will be updated on the terminal status and new output in the future.
				\n\nOutput so far:\n<output>\n${result ?? "No output"}\n</output>`
			}
			return await this.formatToolResponseWithImages(toolRes, userFeedback?.images)
		} catch (error) {
			updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						command,
						output: error.message || JSON.stringify(serializeError(error), null, 2),
						approvalState: "error",
						ts: this.ts,
						earlyExit: undefined,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)
			let errorMessage = error.message || JSON.stringify(serializeError(error), null, 2)
			const errorString = `Error executing command:\n${errorMessage}`
			// await say("error", `Error executing command:\n${errorMessage}`)
			return await this.formatToolError(errorString)
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
