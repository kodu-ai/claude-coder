import { execa, type ResultPromise } from "execa"
import { EventEmitter } from "events"
import treeKill from "tree-kill"
import { IDisposable, ITerminal, ITerminalWindow, IUri } from "@/interfaces/ITerminalManager"
import { ShellIntegration, TerminalEventListener, TerminalExitStatus } from "@/types"

class CLITerminal implements ITerminal {
	private process?: ResultPromise
	private eventEmitter = new EventEmitter()
	private _exitStatus?: TerminalExitStatus
	private output = {
		stdout: "",
		stderr: "",
	}

	constructor(
		public readonly name: string,
		private readonly cwd?: string,
		public readonly shellIntegration?: ShellIntegration
	) {}

	get exitStatus(): TerminalExitStatus | undefined {
		return this._exitStatus
	}

	sendText(text: string, addNewLine = true): void {
		if (!this.process) {
			const subprocess = execa(text, {
				shell: true,
				cwd: this.cwd,
				stdio: ["pipe", "pipe", "pipe"],
			})

			this.process = subprocess

			subprocess.stdout?.on("data", (data: Buffer) => {
				const output = data.toString()
				this.output.stdout += output
				console.log(output)
			})

			subprocess.stderr?.on("data", (data: Buffer) => {
				const output = data.toString()
				this.output.stderr += output
				console.error(output)
			})

			subprocess.on("error", (error) => {
				this._exitStatus = {
					code: 1,
				}
				this.eventEmitter.emit("close")
			})

			subprocess.on("exit", (code: number | null) => {
				this._exitStatus = {
					code: code ?? undefined,
				}
				this.eventEmitter.emit("close")
			})
		} else if (this.process.stdin) {
			this.process.stdin.write(text + (addNewLine ? "\n" : ""))
		}
	}

	dispose(): void {
		if (this.process?.pid) {
			treeKill(this.process.pid, "SIGTERM")
		}
		this.eventEmitter.removeAllListeners()
	}

	show(): void {
		// In CLI context, show just logs the current terminal name
		console.log(`Terminal ${this.name} is active`)
	}

	onClose(listener: () => void): IDisposable {
		this.eventEmitter.on("close", listener)
		return {
			dispose: () => {
				this.eventEmitter.off("close", listener)
			},
		}
	}

	getOutput(): { stdout: string; stderr: string } {
		return this.output
	}
}

export class CLITerminalWindow implements ITerminalWindow {
	private terminals: CLITerminal[] = []
	private eventEmitter = new EventEmitter()

	createTerminal(options: { cwd?: string | IUri; name?: string }): ITerminal {
		const cwd = typeof options.cwd === "string" ? options.cwd : options.cwd?.fsPath
		const terminal = new CLITerminal(options.name || `Terminal ${this.terminals.length + 1}`, cwd)

		this.terminals.push(terminal)

		terminal.onClose(() => {
			const index = this.terminals.indexOf(terminal)
			if (index > -1) {
				this.terminals.splice(index, 1)
				this.eventEmitter.emit("close", terminal)
			}
		})

		return terminal
	}

	onDidCloseTerminal(listener: TerminalEventListener): IDisposable {
		this.eventEmitter.on("close", listener)
		return {
			dispose: () => {
				this.eventEmitter.off("close", listener)
			},
		}
	}

	dispose(): void {
		this.terminals.forEach((terminal) => terminal.dispose())
		this.terminals = []
		this.eventEmitter.removeAllListeners()
	}
}
