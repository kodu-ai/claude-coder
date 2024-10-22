import { EventEmitter } from "events"
import pWaitFor from "p-wait-for"
import stripAnsi from "strip-ansi"
import * as vscode from "vscode"
import { arePathsEqual } from "../../utils/path-helpers"

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
export class TerminalRegistry {
	private static terminals: TerminalInfo[] = []
	private static nextTerminalId = 1
	private static devServers: DevServerInfo[] = [] // Now supports multiple dev servers

	static createTerminal(cwd?: string | vscode.Uri | undefined, name?: string): TerminalInfo {
		const terminal = vscode.window.createTerminal({
			cwd,
			name: name || "Kodu.AI",
		})
		const newInfo: TerminalInfo = {
			terminal,
			busy: false,
			lastCommand: "",
			id: this.nextTerminalId++,
			name,
		}
		this.terminals.push(newInfo)
		return newInfo
	}

	static getTerminal(id: number): TerminalInfo | undefined {
		const terminalInfo = this.terminals.find((t) => t.id === id)
		if (terminalInfo && this.isTerminalClosed(terminalInfo.terminal)) {
			this.removeTerminal(id)
			return undefined
		}
		return terminalInfo
	}

	// Added method to get terminal by name
	static getTerminalByName(name: string): TerminalInfo | undefined {
		const terminalInfo = this.terminals.find((t) => t.name === name)
		if (terminalInfo && this.isTerminalClosed(terminalInfo.terminal)) {
			this.removeTerminal(terminalInfo.id)
			return undefined
		}
		return terminalInfo
	}

	/**
	 * Closes the terminal with the given ID.
	 * @param id The unique ID of the terminal to close.
	 * @returns True if the terminal was found and closed, false otherwise.
	 */
	static closeTerminal(id: number): boolean {
		const terminalInfo = this.getTerminal(id)
		if (terminalInfo) {
			terminalInfo.terminal.dispose()
			this.removeTerminal(id)
			return true
		}
		return false
	}

	static updateTerminal(id: number, updates: Partial<TerminalInfo>) {
		const terminal = this.getTerminal(id)
		if (terminal) {
			Object.assign(terminal, updates)
		}
	}

	static removeTerminal(id: number) {
		this.terminals = this.terminals.filter((t) => t.id !== id)
		// Remove from devServers if exists
		this.devServers = this.devServers.filter((ds) => ds.terminalInfo.id !== id)
	}

	static getAllTerminals(): TerminalInfo[] {
		this.terminals = this.terminals.filter((t) => !this.isTerminalClosed(t.terminal))
		return this.terminals
	}

	// The exit status of the terminal will be undefined while the terminal is active.
	private static isTerminalClosed(terminal: vscode.Terminal): boolean {
		return terminal.exitStatus !== undefined
	}

	// Dev server management methods
	static addDevServer(terminalInfo: TerminalInfo, url: string | null = null) {
		this.devServers.push({ terminalInfo, url })
	}

	static updateDevServerUrl(terminalId: number, url: string) {
		const devServer = this.devServers.find((ds) => ds.terminalInfo.id === terminalId)
		if (devServer) {
			devServer.url = url
		}
	}

	static getDevServer(terminalId: number): DevServerInfo | undefined {
		return this.devServers.find((ds) => ds.terminalInfo.id === terminalId)
	}

	static getDevServerByName(name: string): DevServerInfo | undefined {
		const terminalInfo = this.getTerminalByName(name)
		if (terminalInfo) {
			return this.getDevServer(terminalInfo.id)
		}
		return undefined
	}

	static getAllDevServers(): DevServerInfo[] {
		return this.devServers
	}

	static isDevServerRunning(terminalId: number): boolean {
		const devServer = this.getDevServer(terminalId)
		return !!devServer && !this.isTerminalClosed(devServer.terminalInfo.terminal)
	}

	static isDevServerRunningByName(name: string): boolean {
		const terminalInfo = this.getTerminalByName(name)
		if (terminalInfo) {
			return this.isDevServerRunning(terminalInfo.id)
		}
		return false
	}

	static removeDevServer(terminalId: number) {
		this.devServers = this.devServers.filter((ds) => ds.terminalInfo.id !== terminalId)
	}

	static clearDevServer(terminalId: number) {
		this.closeTerminal(terminalId)
		this.removeDevServer(terminalId)
	}
	static clearAllDevServers() {
		for (const devServer of this.devServers) {
			this.closeTerminal(devServer.terminalInfo.id)
		}
		this.devServers = []
	}
}

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

interface TerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: []
	error: [error: Error]
	no_shell_integration: []
}

export class TerminalProcess extends EventEmitter<TerminalProcessEvents> {
	waitForShellIntegration: boolean = true
	private isListening: boolean = true
	private buffer: string = ""
	private fullOutput: string[] = []
	private lastRetrievedLineIndex: number = 0
	isHot: boolean = false

	async run(terminal: vscode.Terminal, command: string) {
		this.isHot = true // Process is now running
		try {
			if (terminal.shellIntegration && terminal.shellIntegration.executeCommand) {
				const execution = terminal.shellIntegration.executeCommand(command)
				const stream = execution.read()
				let isFirstChunk = true
				let didEmitEmptyLine = false

				for await (let data of stream) {
					// Strip ANSI escape codes and VSCode shell integration sequences
					data = this.cleanDataChunk(data)

					// If after cleaning, data is empty, continue to the next chunk
					if (!data.trim()) {
						continue
					}

					// Process the data chunk
					this.processDataChunk(data, command, isFirstChunk)
					isFirstChunk = false

					// Emit an empty line to indicate the start of command output
					if (!didEmitEmptyLine && this.fullOutput.length === 0) {
						this.emit("line", "")
						didEmitEmptyLine = true
					}
				}

				this.emitRemainingBufferIfListening()
			} else {
				terminal.sendText(command, true)
				this.emit("no_shell_integration")
			}
		} catch (error) {
			this.emit("error", error)
			console.error(`Error in terminal process:`, error)
		} finally {
			this.isHot = false // Process has completed
			this.emitRemainingBufferIfListening()
			this.isListening = false
			this.emit("completed")
			this.emit("continue")
		}
	}

	private cleanDataChunk(data: string): string {
		// Remove VSCode shell integration sequences
		data = data.replace(/\x1b\]633;.*?\x07/g, "")

		// Remove any remaining ANSI escape codes
		data = stripAnsi(data)

		return data
	}

	private processDataChunk(data: string, command: string, isFirstChunk: boolean) {
		// Remove echoed command from the output
		if (isFirstChunk) {
			const lines = data.split("\n")
			const commandIndex = lines.findIndex((line) => line.trim() === command.trim())
			if (commandIndex !== -1) {
				lines.splice(commandIndex, 1)
			}
			data = lines.join("\n")
		}

		// Emit lines
		this.emitIfEol(data)
	}

	private emitIfEol(chunk: string) {
		this.buffer += chunk
		let lineEndIndex: number
		while ((lineEndIndex = this.buffer.indexOf("\n")) !== -1) {
			let line = this.buffer.slice(0, lineEndIndex).trimEnd() // Removes trailing \r
			this.emit("line", line)
			this.fullOutput.push(line)
			this.buffer = this.buffer.slice(lineEndIndex + 1)
		}
	}

	private emitRemainingBufferIfListening() {
		if (this.buffer && this.isListening) {
			const remainingBuffer = this.buffer
			if (remainingBuffer) {
				this.emit("line", remainingBuffer)
				this.fullOutput.push(remainingBuffer)
			}
			this.buffer = ""
		}
	}

	continue() {
		this.emitRemainingBufferIfListening()
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}

	getUnretrievedOutput(updateRetrievedIndex: boolean = true): string {
		const unretrievedLines = this.fullOutput.slice(this.lastRetrievedLineIndex)
		if (updateRetrievedIndex) {
			this.lastRetrievedLineIndex = this.fullOutput.length
		}
		return unretrievedLines.join("\n")
	}

	getOutput(fromLineIndex: number = 0, toLineIndex?: number): string[] {
		return this.fullOutput.slice(fromLineIndex, toLineIndex)
	}

	getFullOutput(): string[] {
		return this.fullOutput.slice()
	}
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
