import { EventEmitter } from "events"
import pWaitFor from "p-wait-for"
import stripAnsi from "strip-ansi"
import * as vscode from "vscode"
import { arePathsEqual } from "../../utils/path-helpers"
import delay from "delay"

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
	logs: string[]
	status: "starting" | "running" | "stopped" | "error"
	error?: string
}

// TerminalRegistry class to manage terminals
export class TerminalRegistry {
	private static terminals: TerminalInfo[] = []
	private static nextTerminalId = 1
	private static devServers: DevServerInfo[] = []
	private static terminalOutputMap: Map<number, string[]> = new Map()
	private static outputBuffers: Map<number, string> = new Map()

	static createTerminal(cwd?: string | vscode.Uri | undefined, name?: string): TerminalInfo {
		const terminal = vscode.window.createTerminal({
			cwd,
			name: name || "Kodu.AI",
			isTransient: true,
		})
		const newInfo: TerminalInfo = {
			terminal,
			busy: false,
			lastCommand: "",
			id: this.nextTerminalId++,
			name,
		}
		this.terminals.push(newInfo)
		this.terminalOutputMap.set(newInfo.id, [])
		this.outputBuffers.set(newInfo.id, "")
		return newInfo
	}

	static addOutput(terminalId: number, output: string, flush: boolean = false) {
		let buffer = this.outputBuffers.get(terminalId) || ""
		buffer += output

		if (flush || buffer.includes("\n")) {
			const lines = buffer.split("\n")
			const completeLines = lines.slice(0, -1)
			const remainingBuffer = lines[lines.length - 1]

			if (completeLines.length > 0) {
				const logs = this.terminalOutputMap.get(terminalId) || []
				logs.push(...completeLines.filter((line) => line.trim()))
				this.terminalOutputMap.set(terminalId, logs)

				const devServer = this.getDevServer(terminalId)
				if (devServer) {
					devServer.logs = logs
				}
			}

			this.outputBuffers.set(terminalId, remainingBuffer)
		}
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
		this.terminalOutputMap.delete(id)
		this.outputBuffers.delete(id)
		const terminal = this.getTerminal(id)
		if (terminal && !this.isTerminalClosed(terminal.terminal)) {
			terminal.terminal.dispose()
			terminal.terminal.shellIntegration?.executeCommand?.("exit")
		}
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
		const logs = this.terminalOutputMap.get(terminalInfo.id) || []
		this.devServers.push({
			terminalInfo,
			url,
			logs,
			status: "starting",
		})
	}

	static updateDevServerUrl(terminalId: number, url: string) {
		const devServer = this.devServers.find((ds) => ds.terminalInfo.id === terminalId)
		if (devServer) {
			devServer.url = url
			devServer.status = "running"
		}
	}

	static updateDevServerStatus(terminalId: number, status: DevServerInfo["status"], error?: string) {
		const devServer = this.devServers.find((ds) => ds.terminalInfo.id === terminalId)
		if (devServer) {
			devServer.status = status
			if (error) {
				devServer.error = error
			}
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
		return !!devServer && devServer.status === "running" && !this.isTerminalClosed(devServer.terminalInfo.terminal)
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
		const now = Date.now()
		for (const devServer of this.devServers) {
			this.closeTerminal(devServer.terminalInfo.id)
		}
		this.devServers = []
		console.log(`All dev servers cleared in ${Date.now() - now}ms`)
	}

	static getTerminalLogs(terminalId: number): string[] {
		return this.terminalOutputMap.get(terminalId) || []
	}

	static flushOutputBuffer(terminalId: number) {
		const buffer = this.outputBuffers.get(terminalId)
		if (buffer && buffer.trim()) {
			this.addOutput(terminalId, "", true)
		}
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
			console.error("Failed to setup shell execution listener:", error)
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
			TerminalRegistry.flushOutputBuffer(terminalInfo.id)
			if (options?.autoClose) {
				this.closeTerminal(terminalInfo.id)
			}
		})

		process.once("no_shell_integration", () => {
			console.log(`No shell integration available for terminal ${terminalInfo.id}`)
			process.emit("no_shell_integration")
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
		if (!terminalInfo.terminal.shellIntegration) {
			console.log("No shell integration")
			process.emit("no_shell_integration")
		}

		if (terminalInfo.terminal.shellIntegration) {
			process.waitForShellIntegration = false
			// first run to make a new line needed for zsh to work correctly
			process.run(terminalInfo.terminal, command, terminalInfo.id)
		} else {
			pWaitFor(() => terminalInfo.terminal.shellIntegration !== undefined, { timeout: 10_000 }).finally(() => {
				const existingProcess = this.processes.get(terminalInfo.id)
				if (existingProcess && existingProcess.waitForShellIntegration) {
					existingProcess.waitForShellIntegration = false
					if (terminalInfo.terminal.shellIntegration) {
						existingProcess.run(terminalInfo.terminal, command, terminalInfo.id)
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
			let terminalCwd = t.terminal.shellIntegration?.cwd // One of Kodu's commands could have changed the cwd of the terminal
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

	// getUnretrievedOutput(terminalId: number, updateRetrievedIndex: boolean = true): string {
	// 	if (!this.terminalIds.has(terminalId)) {
	// 		return ""
	// 	}
	// 	const process = this.processes.get(terminalId)
	// 	return process ? process.getUnretrievedOutput(updateRetrievedIndex) : ""
	// }

	// getPartialOutput(terminalId: number, fromLineIndex: number, toLineIndex?: number): string {
	// 	if (!this.terminalIds.has(terminalId)) {
	// 		return ""
	// 	}
	// 	const process = this.processes.get(terminalId)
	// 	return process ? process.getOutput(fromLineIndex, toLineIndex).join("\n") : ""
	// }

	// getFullOutput(terminalId: number): string {
	// 	if (!this.terminalIds.has(terminalId)) {
	// 		return ""
	// 	}
	// 	const process = this.processes.get(terminalId)
	// 	return process ? process.getFullOutput().join("\n") : ""
	// }

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
		const now = Date.now()
		this.closeAllTerminals()
		this.terminalIds.clear()
		this.processes.clear()
		this.disposables.forEach((disposable) => disposable.dispose())
		this.disposables = []
		console.log(`TerminalManager disposed in ${Date.now() - now}ms`)
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
	private outputQueue: string[] = []
	private processingOutput: boolean = false
	private hotTimer: NodeJS.Timeout | null = null

	async run(terminal: vscode.Terminal, command: string, terminalId: number) {
		this.isHot = true
		try {
			if (terminal.shellIntegration && terminal.shellIntegration.executeCommand) {
				const execution = terminal.shellIntegration.executeCommand(command)
				const stream = execution.read()
				let isFirstChunk = true
				let didEmitEmptyLine = false

				for await (let data of stream) {
					if (isFirstChunk) {
						const outputBetweenSequences = data.match(/\]633;C([\s\S]*?)\]633;D/)?.[1] || ""
						const vscodeSequenceRegex = /\x1b\]633;.[^\x07]*\x07/g
						const lastMatch = [...data.matchAll(vscodeSequenceRegex)].pop()
						if (lastMatch?.index !== undefined) {
							data = data.slice(lastMatch.index + lastMatch[0].length)
						}
						if (outputBetweenSequences.trim()) {
							data = outputBetweenSequences + "\n" + data
						}
						// }
						data = stripAnsi(data)
						// let lines = data.split("\n")
						// if (lines.length > 0) {
						// 	lines[0] = lines[0].replace(/[^\x20-\x7E]/g, "")
						// 	if (lines[0].length >= 2 && lines[0][0] === lines[0][1]) {
						// 		lines[0] = lines[0].slice(1)
						// 	}
						// 	lines[0] = lines[0].replace(/^[^a-zA-Z0-9]*/, "")
						// }
						// data = lines.join("\n")
					} else {
						data = stripAnsi(data)
					}

					if (!data.trim()) continue

					// Remove command echo
					const lines = data.split("\n")
					const filteredLines = lines.filter((line) => !command.includes(line.trim()))
					data = filteredLines.join("\n")

					// Handle hot state
					this.isHot = true
					if (this.hotTimer) clearTimeout(this.hotTimer)

					const compilingMarkers = ["compiling", "building", "bundling"]
					const markerNullifiers = ["compiled", "success", "finish"]
					const isCompiling =
						compilingMarkers.some((m) => data.toLowerCase().includes(m)) &&
						!markerNullifiers.some((n) => data.toLowerCase().includes(n))

					this.hotTimer = setTimeout(
						() => {
							this.isHot = false
						},
						isCompiling ? 15000 : 2000
					)

					if (!didEmitEmptyLine && this.fullOutput.length === 0 && data) {
						await this.queueOutput("", terminalId)
						didEmitEmptyLine = true
					}

					await this.emitIfEol(data, terminalId)
					isFirstChunk = false
				}

				await this.processOutputQueue(terminalId)
				await this.emitRemainingBufferIfListening(terminalId)
			} else {
				terminal.sendText(command, true)
				this.emit("no_shell_integration")
			}
		} catch (error) {
			if (error instanceof Error) {
				this.emit("error", error)
			}
			console.error(`Error in terminal process:`, error)
		} finally {
			this.isHot = false
			await this.processOutputQueue(terminalId)
			await this.emitRemainingBufferIfListening(terminalId)
			this.isListening = false
			this.emit("completed")
			this.emit("continue")
		}
	}

	// Rest of your existing methods remain the same
	private async queueOutput(line: string, terminalId: number) {
		this.outputQueue.push(line)
		await this.processOutputQueue(terminalId)
	}

	private async processOutputQueue(terminalId: number) {
		if (this.processingOutput || this.outputQueue.length === 0) {
			return
		}

		this.processingOutput = true
		try {
			while (this.outputQueue.length > 0) {
				const line = this.outputQueue.shift()!
				this.emit("line", line)
				this.fullOutput.push(line)
				TerminalRegistry.addOutput(terminalId, line + "\n")
				await new Promise((resolve) => setTimeout(resolve, 0))
			}
		} finally {
			this.processingOutput = false
		}
	}

	private async emitIfEol(chunk: string, terminalId: number) {
		this.buffer += chunk

		await this.queueOutput(chunk, terminalId)
	}

	private async emitRemainingBufferIfListening(terminalId: number) {
		if (this.buffer && this.isListening) {
			const remainingBuffer = this.buffer.trim()
			if (remainingBuffer) {
				await this.queueOutput(remainingBuffer, terminalId)
			}
			this.buffer = ""
		}
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
