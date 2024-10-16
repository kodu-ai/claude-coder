import { execa, ExecaError, ResultPromise } from "execa"
import { EventEmitter } from "events"
import treeKill from "tree-kill"

type CommandId = number

interface CommandOutput {
	stdout: string
	stderr: string
}

interface RunningCommand {
	process: ResultPromise
	output: CommandOutput
}

export class ExecaTerminalManager {
	private runningCommands: Map<CommandId, RunningCommand> = new Map()

	async runCommand(
		command: string,
		cwd: string,
		callbackFunction: (event: "error" | "exit" | "response", commandId: CommandId, data: string) => void
	): Promise<CommandId> {
		const commandId = Math.floor(Math.random() * 1000000)
		const subprocess = execa(command, {
			shell: true,
			cwd: cwd,
		})

		const runningCommand: RunningCommand = {
			process: subprocess,
			output: { stdout: "", stderr: "" },
		}

		this.runningCommands.set(commandId, runningCommand)

		subprocess.stdout?.on("data", (data) => {
			runningCommand.output.stdout += data.toString()
			callbackFunction("response", commandId, data.toString())
		})

		subprocess.stderr?.on("data", (data) => {
			runningCommand.output.stderr += data.toString()
			callbackFunction("response", commandId, data.toString())
		})

		subprocess.on("error", (error) => {
			callbackFunction("error", commandId, error.message)
		})

		subprocess.on("exit", (code, signal) => {
			callbackFunction("exit", commandId, "")
			this.runningCommands.delete(commandId)
		})

		return commandId
	}

	async awaitCommand(commandId: CommandId) {
		const runningCommand = this.runningCommands.get(commandId)
		if (runningCommand) {
			return await runningCommand.process
		} else {
			throw new Error(`No running command found with id ${commandId}`)
		}
	}

	sendInput(commandId: CommandId, input: string): void {
		const runningCommand = this.runningCommands.get(commandId)
		if (runningCommand) {
			runningCommand.process.stdin?.write(input)
		} else {
			throw new Error(`No running command found with id ${commandId}`)
		}
	}

	terminateCommand(commandId: CommandId): void {
		const runningCommand = this.runningCommands.get(commandId)
		if (runningCommand && runningCommand.process.pid) {
			treeKill(runningCommand.process.pid, "SIGINT")
		} else {
			throw new Error(`No running command found with id ${commandId}`)
		}
	}

	getCommand(commandId: CommandId): ResultPromise | undefined {
		return this.runningCommands.get(commandId)?.process
	}

	getOutput(commandId: CommandId): CommandOutput | undefined {
		return this.runningCommands.get(commandId)?.output
	}

	isCommandRunning(commandId: CommandId): boolean {
		return this.runningCommands.has(commandId)
	}

	disposeAll(): void {
		for (const [commandId, runningCommand] of this.runningCommands) {
			if (runningCommand.process.pid) {
				treeKill(runningCommand.process.pid, "SIGINT")
			}
			this.runningCommands.delete(commandId)
		}
	}

	on(event: "output", listener: (commandId: CommandId, type: "stdout" | "stderr", data: string) => void): void
	on(event: "error", listener: (commandId: CommandId, error: ExecaError) => void): void
	on(
		event: "exit",
		listener: (commandId: CommandId, code: number | null, signal: NodeJS.Signals | null) => void
	): void
	on(event: string, listener: (...args: any[]) => void): void {
		EventEmitter.prototype.on.call(this, event, listener)
	}

	private emit(event: string, ...args: any[]): boolean {
		return EventEmitter.prototype.emit.call(this, event, ...args)
	}
}
