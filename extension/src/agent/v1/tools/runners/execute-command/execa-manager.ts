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
	private _currentCommand: string = ""

	get currentProcess() {
		return this._currentProcess
	}

	get currentCommand() {
		return this._currentCommand
	}

	executeBlockingCommand: ExecuteCommand = async (
		command: string,
		argsOrOptions?: string[] | ExecuteOptions,
		maybeOptions?: ExecuteOptions
	): Promise<CommandOutput> => {
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
		this._currentCommand = `${command}${args.length ? " " + args.join(" ") : ""}`

		const isShell = (cmd: string): boolean => {
			const commonShells = ["bash", "sh", "zsh", "fish", "dash", "powershell", "cmd", "python3", "python"]
			return commonShells.some((shell) => cmd.toLowerCase().startsWith(shell))
		}

		this._currentProcess = execa(command, args, {
			stdout: "pipe",
			stderr: "pipe",
			stdin: "pipe",
			reject: false,
			killSignal: "SIGTERM",
			cwd: options.cwd,
			shell: !isShell(command),
			all: true,
		})

		const result = await this.collectOutput(this._currentProcess, options)

		if (result.completed) {
			this._currentProcess = null
		}

		return result
	}

	private collectOutput(
		process: ReturnType<typeof execa>,
		options: ExecuteOptions,
		isResume: boolean = false
	): Promise<CommandOutput> {
		return new Promise((resolve) => {
			let hasReturned = false
			const startIndex = this.lastCheckpoint

			console.log(`Starting collection from index ${startIndex}, current output length: ${this.output.length}`)

			const checkOutputLimits = () => {
				if (hasReturned) {
					return
				}

				const pendingOutput = this.output.slice(startIndex)
				console.log(`Checking limits - Pending output length: ${pendingOutput.length}`)
				console.log(`Current lines:\n${pendingOutput}`)

				// Check tokens first since it's simpler
				if (options.outputMaxTokens && pendingOutput.length >= options.outputMaxTokens) {
					hasReturned = true
					// Important: Set checkpoint based on the limit, not the total length
					this.lastCheckpoint = startIndex + options.outputMaxTokens
					resolve({
						output: pendingOutput.slice(0, options.outputMaxTokens),
						exitCode: -1,
						completed: false,
						returnReason: "maxOutput",
					})
					return
				}

				// Then check lines
				if (options.outputMaxLines) {
					const lines = pendingOutput.split("\n")
					const nonEmptyLines = lines.filter((l) => l.length > 0)
					if (nonEmptyLines.length >= options.outputMaxLines) {
						hasReturned = true
						let lineCount = 0
						let cutoffIndex = 0
						for (let i = 0; i < lines.length && lineCount < options.outputMaxLines; i++) {
							if (lines[i].length > 0) {
								lineCount++
							}
							cutoffIndex = i + 1
						}
						const returnOutput = lines.slice(0, cutoffIndex).join("\n")
						this.lastCheckpoint = startIndex + returnOutput.length + (returnOutput.endsWith("\n") ? 0 : 1)
						resolve({
							output: returnOutput,
							exitCode: -1,
							completed: false,
							returnReason: "maxOutput",
						})
					}
				}
			}

			const handleOutput = (data: Buffer) => {
				const chunk = data.toString()
				console.log(`Received chunk:\n${chunk}`)
				console.log(`Buffer before: ${this.output.length}`)
				this.output += chunk
				console.log(`Buffer after: ${this.output.length}`)
				checkOutputLimits()
			}

			// Only use one event handler for the combined stream
			process.all?.on("data", handleOutput)

			const tryResolveOnExit = () => {
				if (!hasReturned) {
					hasReturned = true
					const pendingOutput = this.output.slice(startIndex)
					resolve({
						output: pendingOutput,
						exitCode: exitCode ?? -1,
						completed: true,
						returnReason: "completed",
					})
				}
			}

			let exitCode: number | null = null
			process.once("exit", (code: number | null) => {
				exitCode = code
				tryResolveOnExit()
			})

			if (options.timeout) {
				setTimeout(() => {
					if (!hasReturned) {
						hasReturned = true
						const pendingOutput = this.output.slice(startIndex)
						resolve({
							output: pendingOutput,
							exitCode: -1,
							completed: false,
							returnReason: "timeout",
						})
					}
				}, options.timeout)
			}
		})
	}

	async resumeBlockingCommand(options: ResumeOptions = {}): Promise<CommandOutput> {
		const process = this._currentProcess

		if (process && process.exitCode !== null) {
			const pendingOutput = this.output.slice(this.lastCheckpoint)
			const exitCode = process.exitCode ?? -1
			this.lastCheckpoint = this.output.length
			this._currentProcess = null
			return {
				output: pendingOutput,
				exitCode,
				completed: true,
				returnReason: "completed",
			}
		}

		if (!process) {
			return {
				output: this.output.slice(this.lastCheckpoint),
				exitCode: -1,
				completed: true,
				returnReason: "completed",
			}
		}

		if (typeof options.stdin !== "undefined" && !process.stdin?.destroyed) {
			try {
				await new Promise<void>((resolve) => {
					if (process.stdin?.writable) {
						resolve()
					} else {
						process.stdin?.once("ready", resolve)
					}
				})

				process.stdin?.write(options.stdin)

				if (!options.stdin.endsWith("\n")) {
					process.stdin?.end()
				}
			} catch {
				// Ignore write errors per spec
			}
		}

		const result = await this.collectOutput(process, options, true)
		if (result.completed) {
			this._currentProcess = null
		}
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

		const startIndex = this.lastCheckpoint

		process.kill("SIGTERM")

		const exitCode = await Promise.race([
			new Promise<number>((resolve) => {
				process.once("exit", (code) => resolve(code ?? -1))
			}),
			new Promise<number>((resolve) => {
				setTimeout(() => {
					if (!process.killed) {
						process.kill("SIGKILL")
					}
					resolve(-1)
				}, options.softTimeout || 3000)
			}),
		])

		const pendingOutput = this.output.slice(startIndex)
		this.lastCheckpoint = startIndex + pendingOutput.length

		this._currentProcess = null

		return {
			output: pendingOutput,
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

		const manager = this.managers.get(commandId)!
		const command = manager.currentCommand
		return { manager, id: commandId, command }
	}

	clearManager(commandId: string) {
		this.managers.delete(commandId)
	}

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
