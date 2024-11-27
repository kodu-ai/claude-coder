import Anthropic from "@anthropic-ai/sdk"
import delay from "delay"
import { ExecaError } from "execa"
import { serializeError } from "serialize-error"
import { AdvancedTerminalManager } from "../../../../integrations/terminal"
import { COMMAND_OUTPUT_DELAY } from "../../constants"
import { ToolResponse } from "../../types"
import {
	formatGenericToolFeedback,
	formatToolResponse,
	getCwd,
	getPotentiallyRelevantDetails,
	isTextBlock,
} from "../../utils"
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
			const terminalCompressionThreshold = this.koduDev.getStateManager().state.terminalCompressionThreshold
			const outputTokensLength = this.output.length / 3
			if (terminalCompressionThreshold && outputTokensLength > terminalCompressionThreshold) {
				const SYSTEM_PROMPT = `
You are an assistant tasked with analyzing and summarizing the output of commands run on a user's computer. Your goals are to:

- **Extract the most important and notable information** from the command output.
- **Offer brief explanations** and any relevant insights that may be useful to the user.
- **Format your response using Markdown** for better readability.

**Instructions:**

1. **Determine the type of command output** (e.g., unit test results, server access logs, compilation errors).

2. **For Unit Test Outputs:**

   - Summarize the **total number of tests** run, skipped, passed, and failed.
   - List **which tests failed** and provide brief reasons if available.
   - Suggest potential reasons **why the tests failed or passed**.

3. **For Server Access Logs:**

   - Summarize the **endpoints accessed** and the frequency of access.
   - Highlight any **exceptions or errors** that occurred.
   - Provide possible explanations for **any errors or unusual activity**.

4. **For Other Command Outputs:**

   - Identify and summarize the **key messages**, such as errors, warnings, or success notifications.
   - Explain the significance of these messages to the user.

**Examples:**

---

*Example 1: Unit Test Output*

\`\`\`
Ran 10 tests in 0.005s

FAILED (failures=2)
- test_login: AssertionError: Login failed
- test_data_retrieval: TimeoutError: Data retrieval took too long
\`\`\`

**Summary:**

- **Total Tests Run:** 10
- **Passed:** 8
- **Failed:** 2

**Failed Tests:**

1. \`test_login\` - *AssertionError*: Login failed.
2. \`test_data_retrieval\` - *TimeoutError*: Data retrieval took too long.

**Possible Reasons:**

- The \`test_login\` failure may be due to incorrect credentials or authentication issues.
- The \`test_data_retrieval\` timeout suggests a possible slowdown in the database or network latency.

---

*Example 2: Server Access Log*

\`\`\`
192.168.1.10 - - [10/Oct/2023:13:55:36] "GET /api/users HTTP/1.1" 200 1024
192.168.1.15 - - [10/Oct/2023:13:56:40] "POST /api/login HTTP/1.1" 500 512
192.168.1.10 - - [10/Oct/2023:13:57:22] "GET /api/data HTTP/1.1" 404 256
\`\`\`

**Summary:**

- **Endpoints Accessed:**
  - \`/api/users\` - Successful access.
  - \`/api/login\` - Encountered a \`500 Internal Server Error\`.
  - \`/api/data\` - Returned a \`404 Not Found\` error.

**Exceptions:**

- **500 Internal Server Error** on \`/api/login\` may indicate a server-side issue during the login process.
- **404 Not Found** on \`/api/data\` suggests the requested data endpoint does not exist or has been moved.

**Possible Reasons:**

- The server error on \`/api/login\` could be due to an unhandled exception in the login handler.
- The \`404\` error might result from an incorrect URL or missing resource.

---

*Example 3: Compilation Error Output*

\`\`\`
main.cpp:15:10: error: 'iostream' file not found
1 error generated.
\`\`\`

**Summary:**

- **Error:** \`'iostream' file not found\` in \`main.cpp\` at line 15.

**Possible Reasons:**

- The C++ compiler cannot locate the standard library headers, possibly due to misconfigured include paths or missing installations.

---

**Remember:** Always tailor your summary to highlight the most critical information that will help the user understand the output and take appropriate action.
Your summary should be informative, full of insights, with clear explanations and suggestions where necessary.
Don't be afraid to write long summaries if the output is complex or requires detailed analysis.
You should focus on quality and quantity of information to provide the best assistance to the user.
`
				const resultStream = this.koduDev
					.getApiManager()
					.getApi()
					.createBaseMessageStream(
						SYSTEM_PROMPT,
						[
							{
								role: "user",
								content: [
									{
										type: "text",
										text: `The output for the "${this.paramsInput.command}" command was:\n\n${this.output}`,
									},
								],
							},
						],
						"claude-3-5-haiku-20241022"
					)
				for await (const message of resultStream) {
					if (message.code === 1 && isTextBlock(message.body.anthropic.content[0])) {
						this.output = message.body.anthropic.content[0].text
					}
				}
			}
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
