import Anthropic from "@anthropic-ai/sdk"
import delay from "delay"
import { serializeError } from "serialize-error"
import { getCwd } from "../../../utils"
import { BaseAgentTool } from "../../base-agent.tool"
import { AgentToolOptions, AgentToolParams } from "../../types"
import { getCommandManager } from "./execa-manager"
import { GlobalStateManager } from "../../../../../providers/claude-coder/state/GlobalStateManager"

const COMMAND_TIMEOUT = 90 // 90 seconds
const MAX_RETRIES = 3

type EarlyExitState = "approved" | "rejected" | "pending"

export const shellIntegrationErrorOutput = `Shell integration not available, to run commands in the terminal the user must enable shell integration.
right now the command has been executed but the output cannot be read, unless the user enables shell integration.
currently can only run commands without output, to run commands with output the user must enable shell integration tell the user to enable shell integration to run commands with output.
`

export class ExecuteCommandTool extends BaseAgentTool<"execute_command"> {
	protected params: AgentToolParams<"execute_command">
	private output: string = ""

	constructor(params: AgentToolParams<"execute_command">, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	override async execute() {
		const {
			input: { command, type, id, stdin },
			say,
		} = this.params

		if (type === "resume_blocking_command") {
			return this.resumeBlockingCommand()
		}

		if (type === "terminate_blocking_command") {
			return this.terminateBlockingCommand()
		}

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

	private async resumeBlockingCommand() {
		if (!this.paramsInput.id) {
			this.logger(
				"Missing id parameter when resuming blocking command you must provide the id of the command to resume.",
				"error"
			)
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						approvalState: "error",
						ts: this.ts,
						...this.paramsInput,
						command: "Command not found",
					},
				},
				this.ts
			)
			return this.toolResponse(
				"error",
				"Missing id parameter when resuming blocking command you must provide the id of the command to resume."
			)
		}
		const timeout = GlobalStateManager.getInstance().getGlobalState("commandTimeout") ?? COMMAND_TIMEOUT

		const { manager, command } = getCommandManager(this.paramsInput.id)
		this.paramsInput.command = command
		if (!manager) {
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						approvalState: "error",
						ts: this.ts,
						...this.paramsInput,
					},
				},
				this.ts
			)
			this.logger("No manager found for the provided id when resuming blocking command.", "error")
			return this.toolResponse("error", "No manager found for the provided id when resuming blocking command.")
		}
		try {
			const { response, text, images } = await this.params.ask(
				"tool",
				{
					tool: {
						tool: "execute_command",
						approvalState: "pending",
						ts: this.ts,
						...this.paramsInput,
					},
				},
				this.ts
			)
			if (response !== "yesButtonTapped") {
				if (response === "messageResponse") {
					await this.params.updateAsk(
						"tool",
						{
							tool: {
								tool: "execute_command",
								approvalState: "rejected",
								ts: this.ts,
								...this.paramsInput,
								userFeedback: text,
							},
						},
						this.ts
					)
					await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
					return this.toolResponse("feedback", text, images)
				}
				this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "execute_command",
							approvalState: "rejected",
							ts: this.ts,
							...this.paramsInput,
						},
					},
					this.ts
				)
				return this.toolResponse("rejected", this.formatToolDenied())
			}
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						approvalState: "loading",
						ts: this.ts,
						...this.paramsInput,
					},
				},
				this.ts
			)

			const command = await manager.resumeBlockingCommand({
				cwd: getCwd(),
				outputMaxLines: this.paramsInput.outputMaxLines,
				outputMaxTokens: this.paramsInput.outputMaxTokens,
				timeout,
				stdin: this.paramsInput.stdin,
			})
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						approvalState: "approved",
						ts: this.ts,
						...this.paramsInput,
						output: command.output,
					},
				},
				this.ts
			)

			return this.toolResponse(
				"success",
				`
				<output>${command.output}</output>
				<exitCode>${command.exitCode}</exitCode>
				<completed>${command.completed}</completed>
				<returnReason>${command.returnReason}</returnReason>
				<hint>
				${command.exitCode === 0 ? "" : "The command exited with a non-zero exit code."}
				${command.output.trim() ? "" : "The command did not produce any output."}
				${
					command.returnReason === "timeout"
						? `The command took longer than ${timeout / 1000} seconds to complete.
				it might be posssible that the command is interactive and requires calling resume with stdin param or it might be long running command that requires polling to get the full results (use execute_command with resume and the id)`
						: ""
				}
				${
					command.returnReason === "maxOutput"
						? `The command has outputted more than the maximum allowed output to get the full output please use the resume_blocking_command tool with the id ${this.paramsInput.id}.`
						: ""
				}
				${command.returnReason === "completed" ? "The command has completed successfully." : ""}
				</hint>
				<id>${this.paramsInput.id}</id>
				`
			)
		} catch (error) {
			this.logger("Error resuming blocking command.", "error")
			return this.toolResponse(
				"error",
				"Error resuming blocking command, the command is probably not running anymore."
			)
		}
	}

	private async terminateBlockingCommand() {
		if (!this.paramsInput.id) {
			this.logger(
				"Missing id parameter when terminating blocking command you must provide the id of the command to terminate.",
				"error"
			)
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						approvalState: "error",
						ts: this.ts,
						...this.paramsInput,
						command: "Command not found",
						error: "Missing id parameter when terminating blocking command you must provide the id of the command to terminate.",
					},
				},
				this.ts
			)
			return this.toolResponse(
				"error",
				"Missing id parameter when terminating blocking command you must provide the id of the command to terminate."
			)
		}
		const { manager, command } = getCommandManager(this.paramsInput.id)
		this.paramsInput.command = command
		if (!manager) {
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						approvalState: "error",
						ts: this.ts,
						...this.paramsInput,
					},
				},
				this.ts
			)
			this.logger("No manager found for the provided id when terminating blocking command.", "error")
			return this.toolResponse("error", "No manager found for the provided id when terminating blocking command.")
		}
		try {
			const { response, text, images } = await this.params.ask(
				"tool",
				{
					tool: {
						tool: "execute_command",
						approvalState: "pending",
						ts: this.ts,
						...this.paramsInput,
					},
				},
				this.ts
			)
			if (response !== "yesButtonTapped") {
				if (response === "messageResponse") {
					await this.params.updateAsk(
						"tool",
						{
							tool: {
								tool: "execute_command",
								approvalState: "rejected",
								ts: this.ts,
								userFeedback: text,
								...this.paramsInput,
							},
						},
						this.ts
					)
					await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
					return this.toolResponse("feedback", text, images)
				}
				this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "execute_command",
							approvalState: "rejected",
							ts: this.ts,
							...this.paramsInput,
						},
					},
					this.ts
				)
				return this.toolResponse("rejected", this.formatToolDenied())
			}
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						approvalState: "loading",
						ts: this.ts,
						...this.paramsInput,
					},
				},
				this.ts
			)
			const res = await manager.terminateBlockingCommand({
				softTimeout: this.paramsInput.softTimeout,
			})
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						approvalState: "approved",
						ts: this.ts,
						...this.paramsInput,
					},
				},
				this.ts
			)
			return this.toolResponse(
				"success",
				`
				<terminated>true</terminated>
				<completed>${res.completed}</completed>
				<output>${res.output}</output>
				<id>${this.paramsInput.id}</id>
				<exitCode>${res.exitCode}</exitCode>
				`
			)
		} catch (error) {
			this.logger("Error terminating blocking command.", "error")
			return this.toolResponse("error", "Error terminating blocking command.")
		}
	}

	private async executeShellTerminal(command: string) {
		const { ask, updateAsk, say, returnEmptyStringOnSuccess } = this.params

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
					...this.paramsInput,
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
						...this.paramsInput,
					},
				},
				this.ts
			)

			if (response === "messageResponse") {
				await this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "execute_command",
							command,
							approvalState: "rejected",
							ts: this.ts,
							...this.paramsInput,
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
					...this.paramsInput,
					ts: this.ts,
					isSubMsg: this.params.isSubMsg,
				},
			},
			this.ts
		)

		try {
			const { manager: commandManager, id } = getCommandManager()

			const timeout = GlobalStateManager.getInstance().getGlobalState("commandTimeout")
			const commandTimeout = (timeout ?? COMMAND_TIMEOUT) * 1000

			const result = await commandManager.executeBlockingCommand(command, {
				timeout: commandTimeout,
				cwd: getCwd(),
				outputMaxLines: this.paramsInput.outputMaxLines,
				outputMaxTokens: this.paramsInput.outputMaxTokens,
			})

			this.output = result.output

			await updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						...this.paramsInput,
						output: this.output,
						approvalState: "approved",
						ts: this.ts,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)

			return this.toolResponse(
				"success",
				`
				<output>${this.output}</output>
				<completed>${result.completed}</completed>
				<id>${id}</id>
				<exitCode>${result.exitCode}</exitCode>
				<returnReason>${result.returnReason}</returnReason>
				<hint>
				${result.exitCode === 0 ? "" : "The command exited with a non-zero exit code."}
				${result.output.trim() ? "" : "The command did not produce any output."}
				${result.returnReason === "timeout" ? `The command took longer than ${commandTimeout / 1000} seconds to complete.` : ""}
				${
					result.returnReason === "maxOutput"
						? `The command has outputted more than the maximum allowed output to get the full output please use the resume_blocking_command tool with the id ${id}.`
						: ""
				}
				${result.returnReason === "completed" ? "The command has completed successfully." : ""}
				</hint>
				`
			)
		} catch (error) {
			const errorMessage = (error as Error)?.message || JSON.stringify(serializeError(error), null, 2)
			await updateAsk(
				"tool",
				{
					tool: {
						tool: "execute_command",
						...this.paramsInput,
						command,
						output: errorMessage,
						approvalState: "error",
						ts: this.ts,
						isSubMsg: this.params.isSubMsg,
					},
				},
				this.ts
			)
			return this.toolResponse("error", this.formatToolError(`Error executing command:\n${errorMessage}`))
		}
	}
}
