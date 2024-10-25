import { arePathsEqual } from "@/utils"
import { TerminalProcess } from "./terminal-process"
import { TerminalRegistry } from "./terminal-registry"
import { IDisposable, ITerminal, ITerminalWindow, IUri } from "@/interfaces"
import { TerminalInfo, TerminalProcessResultPromise } from "@/types"

// Merge TerminalProcess and Promise into a single object
export function mergePromise(process: TerminalProcess, promise: Promise<void>): TerminalProcessResultPromise {
	const nativePromisePrototype = (async () => {})().constructor.prototype
	const descriptors = ["then", "catch", "finally"].map(
		(property) => [property, Reflect.getOwnPropertyDescriptor(nativePromisePrototype, property)] as const
	)
	for (const [property, descriptor] of descriptors) {
		if (descriptor) {
			const value = descriptor.value.bind(promise)
			Reflect.defineProperty(process, property, { ...descriptor, value })
		}
	}
	return process as TerminalProcessResultPromise
}

export class TerminalManager {
	private terminalIds: Set<number> = new Set()
	private processes: Map<number, TerminalProcess> = new Map()
	private disposables: IDisposable[] = []
	private terminalWindow: ITerminalWindow

	constructor(terminalWindow: ITerminalWindow) {
		this.terminalWindow = terminalWindow
		TerminalRegistry.initialize(terminalWindow)

		// Initialize shell execution listener if available
		try {
			const window = this.terminalWindow as any
			if (window.onDidStartTerminalShellExecution) {
				const disposable = window.onDidStartTerminalShellExecution(async (e: any) => {
					e?.execution?.read()
				})
				if (disposable) {
					this.disposables.push(disposable)
				}
			}
		} catch (error) {
			console.warn("Shell execution events not supported in this environment")
		}

		// Listen for terminal close events
		const closeDisposable = this.terminalWindow.onDidCloseTerminal((event) => {
			const terminalInfo = TerminalRegistry.getAllTerminals().find((t) => t.terminal === event.terminal)
			if (terminalInfo) {
				this.terminalIds.delete(terminalInfo.id)
				this.processes.delete(terminalInfo.id)
				TerminalRegistry.removeTerminal(terminalInfo.id)
				console.log(`Terminal with ID ${terminalInfo.id} was closed externally.`)
			}
		})
		this.disposables.push(closeDisposable)
	}

	runCommand(
		terminalInfo: TerminalInfo,
		command: string,
		options?: { autoClose?: boolean }
	): TerminalProcessResultPromise {
		terminalInfo.busy = true
		terminalInfo.lastCommand = command
		const process = new TerminalProcess()
		this.processes.set(terminalInfo.id, process)

		process.once("completed", () => {
			terminalInfo.busy = false
			if (options?.autoClose) {
				this.closeTerminal(terminalInfo.id)
			}
		})

		process.once("no_shell_integration", () => {
			console.log(`No shell integration available for terminal ${terminalInfo.id}`)
		})

		const promise = new Promise<void>((resolve, reject) => {
			process.once("continue", () => {
				resolve()
			})
			process.once("error", (error) => {
				console.error(`Error in terminal ${terminalInfo.id}:`, error)
				reject(error)
			})
		})

		if (terminalInfo.terminal.shellIntegration) {
			process.waitForShellIntegration = false
			process.run(terminalInfo.terminal, command)
		} else {
			this.waitForShellIntegration(terminalInfo, process, command)
		}

		return mergePromise(process, promise)
	}

	private async waitForShellIntegration(terminalInfo: TerminalInfo, process: TerminalProcess, command: string) {
		const timeout = 10000
		const startTime = Date.now()

		while (Date.now() - startTime < timeout) {
			if (terminalInfo.terminal.shellIntegration !== undefined) {
				const existingProcess = this.processes.get(terminalInfo.id)
				if (existingProcess && existingProcess.waitForShellIntegration) {
					existingProcess.waitForShellIntegration = false
					if (terminalInfo.terminal.shellIntegration) {
						existingProcess.run(terminalInfo.terminal, command)
					} else {
						terminalInfo.terminal.sendText(command, true)
						existingProcess.emit("completed")
						existingProcess.emit("continue")
						existingProcess.emit("no_shell_integration")
					}
				}
				return
			}
			await new Promise((resolve) => setTimeout(resolve, 100))
		}

		// Timeout reached, fallback to basic terminal
		const existingProcess = this.processes.get(terminalInfo.id)
		if (existingProcess && existingProcess.waitForShellIntegration) {
			existingProcess.waitForShellIntegration = false
			terminalInfo.terminal.sendText(command, true)
			existingProcess.emit("completed")
			existingProcess.emit("continue")
			existingProcess.emit("no_shell_integration")
		}
	}

	async getOrCreateTerminal(cwd: string, name?: string): Promise<TerminalInfo> {
		// Find available terminal from our pool first
		const availableTerminal = TerminalRegistry.getAllTerminals().find((t) => {
			if (t.busy) {
				return false
			}
			if (name && t.name === name) {
				return true
			}
			let terminalCwd = t.terminal.shellIntegration?.cwd
			if (!terminalCwd) {
				return false
			}
			return arePathsEqual(cwd, terminalCwd?.fsPath)
		})

		if (availableTerminal) {
			this.terminalIds.add(availableTerminal.id)
			return availableTerminal
		}

		const newTerminalInfo = TerminalRegistry.createTerminal(cwd, name)
		this.terminalIds.add(newTerminalInfo.id)
		return newTerminalInfo
	}

	getTerminals(busy: boolean): { id: number; name?: string; lastCommand: string }[] {
		return Array.from(this.terminalIds)
			.map((id) => TerminalRegistry.getTerminal(id))
			.filter((t): t is TerminalInfo => t !== undefined && t.busy === busy)
			.map((t) => ({ id: t.id, name: t.name, lastCommand: t.lastCommand }))
	}

	getUnretrievedOutput(terminalId: number, updateRetrievedIndex: boolean = true): string {
		if (!this.terminalIds.has(terminalId)) {
			return ""
		}
		const process = this.processes.get(terminalId)
		return process ? process.getUnretrievedOutput(updateRetrievedIndex) : ""
	}

	getPartialOutput(terminalId: number, fromLineIndex: number, toLineIndex?: number): string {
		if (!this.terminalIds.has(terminalId)) {
			return ""
		}
		const process = this.processes.get(terminalId)
		return process ? process.getOutput(fromLineIndex, toLineIndex).join("\n") : ""
	}

	getFullOutput(terminalId: number): string {
		if (!this.terminalIds.has(terminalId)) {
			return ""
		}
		const process = this.processes.get(terminalId)
		return process ? process.getFullOutput().join("\n") : ""
	}

	isProcessHot(terminalId: number): boolean {
		const process = this.processes.get(terminalId)
		return process ? process.isHot : false
	}

	closeTerminal(id: number): boolean {
		if (!this.terminalIds.has(id)) {
			console.warn(`Terminal with ID ${id} does not exist or is already closed.`)
			return false
		}

		const closed = TerminalRegistry.closeTerminal(id)
		if (closed) {
			this.terminalIds.delete(id)
			this.processes.delete(id)
			console.log(`Terminal with ID ${id} has been closed.`)
		} else {
			console.warn(`Failed to close terminal with ID ${id}. It may have already been disposed.`)
		}

		return closed
	}

	closeAllTerminals(): void {
		for (const id of Array.from(this.terminalIds)) {
			this.closeTerminal(id)
		}
	}

	disposeAll() {
		this.closeAllTerminals()
		this.terminalIds.clear()
		this.processes.clear()
		this.disposables.forEach((disposable) => disposable.dispose())
		this.disposables = []
	}
}
