import type { execa } from "execa"
import { nanoid } from "nanoid"

interface CommandOutput {
	output: string
	exitCode: number
	completed: boolean
	returnReason: "timeout" | "maxOutput" | "completed" | "terminated"
}

interface ExecuteOptions {
	timeout?: number
	outputMaxLines?: number
	outputMaxTokens?: number
	cwd?: string
}

interface ResumeOptions extends ExecuteOptions {
	stdin?: string
}

interface TerminateOptions {
	softTimeout?: number
}

type ExecuteCommand = {
	(command: string, options?: ExecuteOptions): Promise<CommandOutput>
	(command: string, args: string[], options?: ExecuteOptions): Promise<CommandOutput>
}
class CommandManager {
	private _currentProcess: ReturnType<typeof execa> | null = null
	private output: string = ""
	private lastCheckpoint: number = 0

	get currentProcess() {
		return this._currentProcess
	}

	// Our main methods remain largely the same, but with improved stdin handling
	executeBlockingCommand: ExecuteCommand = async (
		command: string,
		argsOrOptions?: string[] | ExecuteOptions,
		maybeOptions?: ExecuteOptions
	): Promise<CommandOutput> => {
		// Determine if we're using the single string or array arguments format
		let options: ExecuteOptions
		let args: string[] = []

		if (Array.isArray(argsOrOptions)) {
			args = argsOrOptions
			options = maybeOptions || {}
		} else {
			options = argsOrOptions || {}
		}

		if (this._currentProcess) {
			throw new Error("A command is already running")
		}

		const { execa } = await import("execa")
		this.output = ""
		this.lastCheckpoint = 0

		this._currentProcess = execa({
			stdout: "pipe",
			stderr: "pipe",
			stdin: "pipe",
			reject: false,
			killSignal: "SIGTERM",
			cwd: options.cwd,
			shell: true,
		})`${command}${args ? " " + args.join(" ") : ""}`
		const result = await this.collectOutput(this._currentProcess, options)

		if (result.completed) {
			this._currentProcess = null
		}
		this.lastCheckpoint = this.output.length

		return result
	}
	private collectOutput(
		process: ReturnType<typeof execa>,
		options: ExecuteOptions,
		isResume: boolean = false
	): Promise<CommandOutput> {
		return new Promise((resolve) => {
			let output = ""
			let hasReturned = false

			const onData = (data: Buffer) => {
				const chunk = data.toString()
				output += chunk
				this.output += chunk

				// Check limits only on new data
				const lines = output.split("\n").filter((l) => l.length > 0)
				if (options.outputMaxLines && lines.length >= options.outputMaxLines) {
					returnEarly(lines.slice(0, options.outputMaxLines).join("\n"))
				}
				if (options.outputMaxTokens && output.length >= options.outputMaxTokens) {
					returnEarly(output.slice(0, options.outputMaxTokens))
				}
			}

			const returnEarly = (limitedOutput: string) => {
				if (!hasReturned) {
					hasReturned = true
					cleanup()
					resolve({
						output: limitedOutput,
						exitCode: -1,
						completed: false,
						returnReason: "maxOutput",
					})
				}
			}

			const cleanup = () => {
				process.stdout?.removeListener("data", onData)
				process.stderr?.removeListener("data", onData)
				process.removeListener("exit", onExit)
				if (timeoutId) {
					clearTimeout(timeoutId)
				}
			}

			process.stdout?.on("data", onData)
			process.stderr?.on("data", onData)

			const onExit = (code: number | null) => {
				if (!hasReturned) {
					hasReturned = true
					cleanup()
					resolve({
						output: output,
						exitCode: code ?? -1,
						// Key change: Only mark as completed on natural exit AND not during resume
						completed: !isResume && code !== null,
						returnReason: code === null ? "timeout" : "completed",
					})
				}
			}

			process.once("exit", onExit)

			const timeoutId = options.timeout ? setTimeout(() => returnEarly(output), options.timeout) : null
		})
	}

	async resumeBlockingCommand(options: ResumeOptions = {}): Promise<CommandOutput> {
		const process = this._currentProcess
		if (!process) {
			return {
				output: this.output.slice(this.lastCheckpoint),
				exitCode: -1,
				completed: true,
				returnReason: "completed",
			}
		}

		// Improved stdin handling that properly sequences write operations
		if (options.stdin && process.stdin && !process.stdin.destroyed) {
			try {
				// First ensure the stream is ready
				await new Promise<void>((resolve) => {
					if (process.stdin?.writable) {
						resolve()
					} else {
						process.stdin?.once("ready", resolve)
					}
				})

				// Then write the data in a non-blocking way
				process.stdin.write(options.stdin)

				// Finally end the stream
				process.stdin.end()
			} catch {
				// Ignore write errors per spec
			}
		}

		// Pass isResume=true to indicate this is a resume operation
		const result = await this.collectOutput(process, options, true)
		this.lastCheckpoint = this.output.length
		return result
	}

	async terminateBlockingCommand(options: TerminateOptions = {}): Promise<CommandOutput> {
		const process = this._currentProcess
		if (!process) {
			return {
				output: this.output.slice(this.lastCheckpoint),
				exitCode: -1,
				completed: true,
				returnReason: "completed",
			}
		}

		// Start collecting output immediately
		let finalOutput = ""
		const onData = (data: Buffer) => {
			finalOutput += data.toString()
			this.output += data.toString()
		}

		process.stdout?.on("data", onData)
		process.stderr?.on("data", onData)

		// First try SIGTERM
		process.kill("SIGTERM")

		// Wait for process to exit or soft timeout
		const exitCode = await Promise.race([
			new Promise<number>((resolve) => {
				process.once("exit", (code) => resolve(code ?? -1))
			}),
			new Promise<number>((resolve) => {
				setTimeout(() => {
					// If process is still running, send SIGKILL
					if (!process.killed) {
						process.kill("SIGKILL")
					}
					resolve(-1)
				}, options.softTimeout || 3000)
			}),
		])

		// Clean up
		process.stdout?.removeListener("data", onData)
		process.stderr?.removeListener("data", onData)
		this._currentProcess = null
		this.lastCheckpoint = this.output.length

		return {
			output: finalOutput,
			exitCode,
			completed: true,
			returnReason: "terminated",
		}
	}
}
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

	getManager(commandId: string) {
		if (!this.managers.has(commandId)) {
			this.managers.set(commandId, new CommandManager())
		}
		return { manager: this.managers.get(commandId)!, id: commandId }
	}

	clearManager(commandId: string) {
		this.managers.delete(commandId)
	}

	// For testing purposes
	clearAll() {
		this.managers.clear()
	}
}

export const getCommandManager = (commandId?: string) => {
	const id = commandId ?? nanoid(8)
	return CommandRegistry.getInstance().getManager(id)
}

export const clearCommandRegistry = () => {
	CommandRegistry.getInstance().clearAll()
}

export const clearCommandManager = (commandId: string) => {
	CommandRegistry.getInstance().clearManager(commandId)
}
