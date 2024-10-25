import { EventEmitter } from "events"
import pWaitFor from "p-wait-for"
import stripAnsi from "strip-ansi"
import * as vscode from "vscode"
import { arePathsEqual } from "@/utils"
import { TerminalProcess } from "./terminal-process"
import { TerminalRegistry } from "./terminal-resigtry"

/*
TerminalManager:
- Creates/reuses terminals
- Now supports multiple dev servers
- Assigns names to terminals for identification
- Runs commands via runCommand(), returning a TerminalProcessResultPromise
- Handles shell integration events

TerminalProcess extends EventEmitter and implements Promise:
- Emits 'line' events with output while promise is pending
- process.continue() resolves promise and stops event emission
- Allows real-time output handling or background execution
- Keeps track of output, supports retrieving outputs, including partial outputs
- Supports tracking retrieved/unretrieved outputs
- Remembers terminal output even after retrieval

Enhancements:
- Improved output parsing to handle different shell prompts and themes
- Robust handling of multiple terminals
- Added option to auto-close terminal after command execution
*/

declare module "vscode" {
	interface Terminal {
		// @ts-expect-error
		shellIntegration?: {
			cwd?: vscode.Uri
			executeCommand?: (command: string) => {
				read: () => AsyncIterable<string>
			}
		}
	}
	interface Window {
		onDidStartTerminalShellExecution?: (
			listener: (e: any) => any,
			thisArgs?: any,
			disposables?: vscode.Disposable[]
		) => vscode.Disposable
	}
}

export interface TerminalInfo {
	terminal: vscode.Terminal
	busy: boolean
	lastCommand: string
	id: number
	name?: string // Added optional name property
}

export interface DevServerInfo {
	terminalInfo: TerminalInfo
	url: string | null
}

// TerminalRegistry class to manage terminals

export class TerminalManager {
	private terminalIds: Set<number> = new Set()
	private processes: Map<number, TerminalProcess> = new Map()
	private disposables: vscode.Disposable[] = []

	constructor() {
		let disposable: vscode.Disposable | undefined
		try {
			disposable = (vscode.window as vscode.Window).onDidStartTerminalShellExecution?.(async (e) => {
				e?.execution?.read()
			})
		} catch (error) {
			// Handle error if needed
		}
		if (disposable) {
			this.disposables.push(disposable)
		}

		// Listen for terminal close events
		const closeDisposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
			const terminalInfo = TerminalRegistry.getAllTerminals().find((t) => t.terminal === closedTerminal)
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
			pWaitFor(() => terminalInfo.terminal.shellIntegration !== undefined, { timeout: 10000 }).finally(() => {
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
			})
		}

		return mergePromise(process, promise)
	}

	async getOrCreateTerminal(cwd: string, name?: string): Promise<TerminalInfo> {
		// Find available terminal from our pool first (created for this task)
		const availableTerminal = TerminalRegistry.getAllTerminals().find((t) => {
			if (t.busy) {
				return false
			}
			if (name && t.name === name) {
				return true
			}
			let terminalCwd = t.terminal.shellIntegration?.cwd // One of cline's commands could have changed the cwd of the terminal
			if (!terminalCwd) {
				return false
			}
			return arePathsEqual(vscode.Uri.file(cwd).fsPath, terminalCwd?.fsPath)
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

	/**
	 * Closes the terminal with the given ID.
	 * @param id The unique ID of the terminal to close.
	 * @returns True if the terminal was found and closed, false otherwise.
	 */
	closeTerminal(id: number): boolean {
		if (!this.terminalIds.has(id)) {
			console.warn(`Terminal with ID ${id} does not exist or is already closed.`)
			return false
		}

		const closed = TerminalRegistry.closeTerminal(id)
		if (closed) {
			// Remove the terminal from tracking
			this.terminalIds.delete(id)
			this.processes.delete(id)
			console.log(`Terminal with ID ${id} has been closed.`)
		} else {
			console.warn(`Failed to close terminal with ID ${id}. It may have already been disposed.`)
		}

		return closed
	}

	/**
	 * Closes all managed terminals.
	 */
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

export interface TerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: []
	error: [error: Error]
	no_shell_integration: []
}

export type TerminalProcessResultPromise = TerminalProcess & Promise<void>

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
