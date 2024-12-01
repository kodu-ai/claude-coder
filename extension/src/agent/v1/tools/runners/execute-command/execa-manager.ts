import { execa, type Options as ExecaOptions, type ExecaError } from "execa"
import type { ChildProcess } from "child_process"

// Interfaces
interface CommandOutput {
	output: string
	exitCode: number
	completed: boolean
}

interface ExecuteOptions {
	timeout?: number
	outputMaxLines?: number
	outputMaxTokens?: number
	outputMaxBytes?: number
}

interface ResumeOptions extends ExecuteOptions {
	stdin?: string
}

interface TerminateOptions {
	softTimeout?: number
}

// Command Registry to maintain singleton instances for different command types
class CommandRegistry {
	private static instance: CommandRegistry
	private managers: Map<string, CommandManager> = new Map()

	private constructor() {}

	static getInstance(): CommandRegistry {
		if (!CommandRegistry.instance) {
			CommandRegistry.instance = new CommandRegistry()
		}
		return CommandRegistry.instance
	}

	getManager(commandId: string): CommandManager {
		if (!this.managers.has(commandId)) {
			this.managers.set(commandId, new CommandManager())
		}
		return this.managers.get(commandId)!
	}
}

// Command Manager Class
class CommandManager {
	private currentProcess: ChildProcess | null = null
	private outputBuffer: string = ""
	private isRunning: boolean = false

	private checkOutputLimits(output: string, maxLines?: number, maxTokens?: number, maxBytes?: number): boolean {
		if (maxLines && output.split("\n").length >= maxLines) {
			return true
		}
		if (maxTokens && output.length >= maxTokens) {
			return true
		}
		if (maxBytes && Buffer.from(output).length >= maxBytes) {
			return true
		}
		return false
	}

	async executeBlockingCommand(
		command: string,
		args: string[] = [],
		options: ExecuteOptions = {}
	): Promise<CommandOutput> {
		if (this.isRunning) {
			throw new Error("A command is already running")
		}

		const { timeout = 30000, outputMaxLines = 1000, outputMaxTokens = 10000, outputMaxBytes = 100000 } = options

		this.outputBuffer = ""
		this.isRunning = true

		try {
			const execaOptions: ExecaOptions = {
				timeout,
				buffer: false,
			}

			const execaProcess = execa(command, args, execaOptions)
			this.currentProcess = execaProcess

			if (!this.currentProcess) {
				throw new Error("Failed to start process")
			}

			execaProcess.stdout?.on("data", (data: Buffer) => {
				this.outputBuffer += data.toString()
				if (this.checkOutputLimits(this.outputBuffer, outputMaxLines, outputMaxTokens, outputMaxBytes)) {
					execaProcess.kill()
				}
			})

			execaProcess.stderr?.on("data", (data: Buffer) => {
				this.outputBuffer += data.toString()
				if (this.checkOutputLimits(this.outputBuffer, outputMaxLines, outputMaxTokens, outputMaxBytes)) {
					execaProcess.kill()
				}
			})

			const result = await execaProcess
			this.isRunning = false

			return {
				output: this.outputBuffer,
				exitCode: result.exitCode ?? -1,
				completed: true,
			}
		} catch (error) {
			const execaError = error as ExecaError
			if (execaError.timedOut) {
				return {
					output: this.outputBuffer,
					exitCode: -1,
					completed: false,
				}
			}
			throw error
		}
	}

	async resumeBlockingCommand(options: ResumeOptions = {}): Promise<CommandOutput> {
		if (!this.isRunning || !this.currentProcess) {
			throw new Error("No command is currently running")
		}

		const {
			timeout = 30000,
			stdin = "",
			outputMaxLines = 1000,
			outputMaxTokens = 10000,
			outputMaxBytes = 100000,
		} = options

		if (stdin) {
			this.currentProcess.stdin?.write(stdin)
		}

		type ExitResult = { exitCode: number }
		type TimeoutResult = never

		try {
			const result = await Promise.race<ExitResult | TimeoutResult>([
				new Promise<ExitResult>((resolve, reject) => {
					this.currentProcess!.on("exit", (code) => {
						resolve({ exitCode: code ?? -1 })
					})
					this.currentProcess!.on("error", reject)
				}),
				new Promise<TimeoutResult>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout)),
			])

			this.isRunning = false
			return {
				output: this.outputBuffer,
				exitCode: result.exitCode,
				completed: true,
			}
		} catch (error) {
			return {
				output: this.outputBuffer,
				exitCode: -1,
				completed: false,
			}
		}
	}

	async terminateBlockingCommand(options: TerminateOptions = {}): Promise<CommandOutput> {
		if (!this.currentProcess) {
			throw new Error("No command is currently running")
		}

		const { softTimeout = 5000 } = options

		try {
			// Attempt soft kill first
			this.currentProcess.kill("SIGTERM")

			// Wait for the process to exit gracefully
			await Promise.race([
				new Promise<void>((resolve) => {
					this.currentProcess!.on("exit", () => resolve())
				}),
				new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Soft kill timeout")), softTimeout)),
			])
		} catch (error) {
			// If soft kill fails, force kill
			this.currentProcess.kill("SIGKILL")
		}

		this.isRunning = false
		return {
			output: this.outputBuffer,
			exitCode: -1,
			completed: true,
		}
	}
}

// Example usage
export const getCommandManager = (commandId: string): CommandManager => {
	return CommandRegistry.getInstance().getManager(commandId)
}
