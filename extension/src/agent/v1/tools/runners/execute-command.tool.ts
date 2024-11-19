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
import { TerminalProcessResultPromise } from "../../../../integrations/terminal/terminal-manager"

const COMMAND_TIMEOUT = 90_000 // 90 seconds
const MAX_RETRIES = 3

type EarlyExitState = "approved" | "rejected" | "pending"

export const shellIntegrationErrorOutput = `Shell integration not available, to run commands in the terminal the user must enable shell integration.
right now the command has been executed but the output cannot be read, unless the user enables shell integration.
currently can only run commands without output, to run commands with output the user must enable shell integration tell the user to enable shell integration to run commands with output.
`

export class ExecuteCommandTool extends BaseAgentTool {
	protected params: AgentToolParams
	private execaTerminalManager: ExecaTerminalManager
	private output: string = ""

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.execaTerminalManager = new ExecaTerminalManager()
	}

	override async execute() {
		const { input, say } = this.params
		const { command } = input as { command?: string }

		if (!command?.trim()) {
			await say(
				"error",
				"Claude tried to use execute_command without value for required parameter 'command'. Retrying..."
			)
			return this.toolResponse(
				"error",
				`Error: Missing or empty command parameter. Please provide a valid command.`
			)
		}

		return this.executeShellTerminal(command)
	}

	private isApprovedState(state: EarlyExitState): state is "approved" {
		return state === "approved"
	}

	private async executeShellTerminal(command: string) {
		const { terminalManager } = this.koduDev
		if (!(terminalManager instanceof AdvancedTerminalManager)) {
			throw new Error("AdvancedTerminalManager is not available")
		}

		const { ask, updateAsk, say, returnEmptyStringOnSuccess } = this.params
		const cwd = getCwd()

		// Initial approval request
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

			if (response === "messageResponse" && !this.alwaysAllowWriteOnly) {
				await this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "execute_command",
							command,
							approvalState: "rejected",
							ts: this.ts,
							userFeedback: text,
							isSubMsg: this.params.isSubMsg,
						},
					},
					this.ts
				)
				await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
				return this.toolResponse("feedback", this.formatToolDeniedFeedback(text), images)
			}
			return this.toolResponse("rejected", this.formatToolDenied())
		}

		// Set loading state
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

		let process: TerminalProcessResultPromise | null = null

		const terminalInfo = await terminalManager.getOrCreateTerminal(this.cwd)
		terminalInfo.terminal.show()

		process = terminalManager.runCommand(terminalInfo, command, {
			autoClose: this.koduDev.getStateManager().autoCloseTerminal ?? false,
		})

		if (!process) {
			throw new Error("Failed to create terminal process after retries")
		}

		let userFeedback: { text?: string; images?: string[] } | undefined
		let didContinue = false
		let earlyExit: EarlyExitState = "pending"

		let completed = false
		let shellIntegrationWarningShown = false

		try {
			const completionPromise = new Promise<void>((resolve) => {
				process!.once("completed", () => {
					earlyExit = "approved"
					completed = true
					resolve()
				})
				process.once("no_shell_integration", async () => {
					await say("shell_integration_warning")
					await updateAsk(
						"tool",
						{
							tool: {
								tool: "execute_command",
								command,
								output: this.output,
								approvalState: "error",
								ts: this.ts,
								error: "Shell integration is not available, cannot read output.",
								earlyExit: undefined,
								isSubMsg: this.params.isSubMsg,
							},
						},
						this.ts
					)
					shellIntegrationWarningShown = true
					completed = true
					earlyExit = "approved"
					resolve()
				})
			})
			process.on("line", async (line) => {
				const cleanedLine = line
				if (cleanedLine) {
					this.output += cleanedLine + "\n"
					if (!didContinue || this.isApprovedState(earlyExit)) {
						try {
							await updateAsk(
								"tool",
								{
									tool: {
										tool: "execute_command",
										command,
										output: this.output,
										approvalState: "loading",
										ts: this.ts,
										earlyExit,
										isSubMsg: this.params.isSubMsg,
									},
								},
								this.ts
							)
						} catch (error) {
							console.error("Failed to update output:", error)
						}
					}
				}
			})
			process.on("error", async (error) => {
				console.log(`Error in process: ${error}`)
			})

			// Wait for either completion or timeout
			await Promise.race([
				completionPromise,
				delay(COMMAND_TIMEOUT).then(() => {
					if (!completed) {
						console.log("Command timed out after", COMMAND_TIMEOUT, "ms")
					}
				}),
			])

			// Ensure all output is processed
			await delay(300)
			if (shellIntegrationWarningShown) {
				return this.toolResponse("error", shellIntegrationErrorOutput)
			}

			await updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						command,
						output: this.output,
						approvalState: "approved",
						ts: this.ts,
						earlyExit,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)

			let toolRes = "The command has been executed."
			if (completed) {
				toolRes = "Command execution completed successfully."
			}

			this.logger(`Output: ${this.output}`)

			if ((userFeedback?.text && userFeedback.text.length) || userFeedback?.images?.length) {
				toolRes += `\n\nUser feedback:\n<feedback>\n${userFeedback.text}\n</feedback>`
				await this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "execute_command",
							command,
							output: this.output,
							approvalState: "approved",
							ts: this.ts,
							earlyExit,
							userFeedback: userFeedback.text,
							isSubMsg: this.params.isSubMsg,
						},
					},
					this.ts
				)
			}

			if (returnEmptyStringOnSuccess) {
				return this.toolResponse("success", "No output")
			}

			if (completed) {
				toolRes += `\n\nOutput:\n<output>\n${this.output || "No output"}\n</output>`
			} else {
				toolRes += `\n\nPartial output available:\n<output>\n${this.output || "No output"}\n</output>`
			}

			return await this.toolResponse("success", toolRes, userFeedback?.images)
		} catch (error) {
			const errorMessage = (error as Error)?.message || JSON.stringify(serializeError(error), null, 2)
			updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						command,
						output: errorMessage,
						approvalState: "error",
						ts: this.ts,
						earlyExit: undefined,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)
			return this.toolResponse("error", this.formatToolError(`Error executing command:\n${errorMessage}`))
		}
	}
}
