import { EventEmitter } from "events"
import * as vscode from "vscode"
import { arePathsEqual } from "../../utils/path-helpers"
import {execa } from "execa"

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
	private shellIntegrationStatus: Map<number, boolean> = new Map() // Track shell integration status per terminal

	constructor() {
		let disposable: vscode.Disposable | undefined
		try {
			// Listen for shell execution events
			disposable = (vscode.window as vscode.Window).onDidStartTerminalShellExecution?.(async (e) => {
				e?.execution?.read()
			})
		} catch (error) {
			console.error("Failed to setup shell execution listener:", error)
		}
		if (disposable) {
			this.disposables.push(disposable)
		}

		// Add shell integration change listener
		const shellIntegrationDisposable = vscode.window.onDidChangeTerminalShellIntegration((terminal) => {
			const terminalInfo = TerminalRegistry.getAllTerminals().find((t) => t.terminal === terminal.terminal)
			if (terminalInfo) {
				console.log(`Shell integration changed for terminal ${terminalInfo.id}:`, terminal.shellIntegration)
				this.shellIntegrationStatus.set(terminalInfo.id, !!terminal.shellIntegration)
			}
		})
		this.disposables.push(shellIntegrationDisposable)

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

	private async waitForShellIntegration(terminalInfo: TerminalInfo): Promise<boolean> {
		return new Promise((resolve) => {
			console.log(`[waitForShellIntegration] Starting for terminal ${terminalInfo.id}`);
			
			// If shell integration is already available, resolve immediately
			if (terminalInfo.terminal.shellIntegration) {
				console.log(`[waitForShellIntegration] Shell integration already available for terminal ${terminalInfo.id}`, terminalInfo.terminal.shellIntegration);
				this.shellIntegrationStatus.set(terminalInfo.id, true)
				resolve(true)
				return
			}

			// Set up the shell integration change listener
			const disposable = vscode.window.onDidChangeTerminalShellIntegration((terminal) => {
				console.log(`[ShellIntegrationChange] Event triggered for a terminal`, {
					expectedId: terminalInfo.id,
					hasShellIntegration: !!terminal.terminal.shellIntegration,
					isMatchingTerminal: terminal.terminal === terminalInfo.terminal
				});

				if (terminal.terminal === terminalInfo.terminal) {
					console.log(`[ShellIntegrationChange] Shell integration activated for terminal ${terminalInfo.id}`, terminal.terminal.shellIntegration);
					this.shellIntegrationStatus.set(terminalInfo.id, true)
					clearTimeout(timeoutId)
					disposable.dispose()
					resolve(true)
				}
			})

			// Set up timeout
			const timeoutId = setTimeout(() => {
				console.log(`[waitForShellIntegration] Timeout reached for terminal ${terminalInfo.id}`);
				disposable.dispose()
				if (!this.shellIntegrationStatus.get(terminalInfo.id)) {
					console.log(`[waitForShellIntegration] No shell integration available after timeout for terminal ${terminalInfo.id}`);
					this.shellIntegrationStatus.set(terminalInfo.id, false)
					resolve(false)
				} else {
					console.log(`[waitForShellIntegration] Shell integration was set during timeout for terminal ${terminalInfo.id}`);
				}
			}, 5000)
		})
	}

	runCommand(
		terminalInfo: TerminalInfo,
		command: string,
		options?: { autoClose?: boolean }
	): TerminalProcessResultPromise {
		console.log(`[runCommand] Starting command execution for terminal ${terminalInfo.id}`, {
			hasShellIntegration: !!terminalInfo.terminal.shellIntegration,
			command
		});

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

		if (terminalInfo.terminal.shellIntegration) {
			console.log(`[runCommand] Using existing shell integration for terminal ${terminalInfo.id}`);
			process.waitForShellIntegration = false
			process.run(terminalInfo.terminal, command, terminalInfo.id)
		} else {
			console.log(`[runCommand] Waiting for shell integration for terminal ${terminalInfo.id}`);
			process.waitForShellIntegration = true
			
			this.waitForShellIntegration(terminalInfo).then((hasShellIntegration) => {
				console.log(`[runCommand] Shell integration wait completed`, {
					terminalId: terminalInfo.id,
					hasShellIntegration,
					hasProcess: this.processes.has(terminalInfo.id),
					currentShellIntegration: !!terminalInfo.terminal.shellIntegration
				});

				const existingProcess = this.processes.get(terminalInfo.id)
				if (!existingProcess || !existingProcess.waitForShellIntegration) {
					console.log(`[runCommand] Process no longer waiting for shell integration`, {
						terminalId: terminalInfo.id,
						hasProcess: !!existingProcess
					});
					return
				}

				existingProcess.waitForShellIntegration = false
				
				if (hasShellIntegration && terminalInfo.terminal.shellIntegration) {
					console.log(`[runCommand] Running command with shell integration`, {
						terminalId: terminalInfo.id,
						command
					});
					existingProcess.run(terminalInfo.terminal, command, terminalInfo.id)
				} else {
					console.log(`[runCommand] Falling back to basic terminal`, {
						terminalId: terminalInfo.id,
						command
					});
					existingProcess.emit("no_shell_integration")
					terminalInfo.terminal.sendText(command, true)
					setTimeout(() => {
						existingProcess.emit("completed")
						existingProcess.emit("continue")
					}, 100)
				}
			})
		}

		const promise = new Promise<void>((resolve, reject) => {
			process.once("continue", () => {
				resolve()
			})
			process.once("error", (error) => {
				console.error(`Error in terminal ${terminalInfo.id}:`, error)
				reject(error)
			})
		})

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
		this.shellIntegrationStatus.clear() // Clear shell integration status
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
		console.log('[TerminalProcess.run] Starting command execution:', {
			hasShellIntegration: !!terminal.shellIntegration,
			command,
			terminalId
		});
		
		this.isHot = true
		try {
			// First try shell integration
			if (terminal.shellIntegration && terminal.shellIntegration.executeCommand) {
				console.log('[TerminalProcess.run] Using shell integration');
				const execution = terminal.shellIntegration.executeCommand(command);
				
				// Also run with execa to capture output
				const shellCmd = process.platform === "win32" ? ["cmd", "/c"] : ["sh", "-c"];
				const subprocess = execa(shellCmd[0], [...shellCmd.slice(1), command], {
					cwd: terminal.shellIntegration?.cwd?.fsPath || process.cwd(),
					env: process.env,
					stripFinalNewline: false,
					buffer: false, // Stream output instead of buffering
				});

				// Handle stdout
				subprocess.stdout?.on("data", (data: Buffer) => {
					const lines = data.toString().split("\n");
					for (const line of lines) {
						if (line.trim()) {
							console.log('[TerminalProcess.run] Output line:', line.trim());
							this.emit("line", line.trim());
							this.fullOutput.push(line.trim());
							TerminalRegistry.addOutput(terminalId, line.trim() + "\n");
						}
					}
				});

				// Handle stderr
				subprocess.stderr?.on("data", (data: Buffer) => {
					const lines = data.toString().split("\n");
					for (const line of lines) {
						if (line.trim()) {
							console.log('[TerminalProcess.run] Error line:', line.trim());
							this.emit("line", line.trim());
							this.fullOutput.push(line.trim());
							TerminalRegistry.addOutput(terminalId, line.trim() + "\n");
						}
					}
				});

				try {
					await subprocess;
				} catch (error) {
					if (error instanceof Error) {
						console.error('[TerminalProcess.run] Subprocess error:', error);
					}
				}

			} else {
				console.log('[TerminalProcess.run] No shell integration, falling back to sendText');
				terminal.sendText(command, true);
				this.emit("no_shell_integration");
			}
		} catch (error) {
			console.error('[TerminalProcess.run] Error:', error);
			if (error instanceof Error) {
				this.emit("error", error);
			}
		} finally {
			this.isHot = false;
			this.isListening = false;
			this.emit("completed");
			this.emit("continue");
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
		// If we already have content in buffer and receiving new chunk,
		// emit the existing buffer first
		if (this.buffer && chunk) {
			const existingLine = this.buffer.trim()
			if (existingLine) {
				await this.queueOutput(existingLine, terminalId)
			}
			this.buffer = ""
		}

		this.buffer += chunk

		// Handle carriage returns
		if (this.buffer.includes("\r")) {
			const lines = this.buffer.split("\r")
			const line = lines[lines.length - 1].trim()
			if (line) {
				await this.queueOutput(line, terminalId)
			}
			this.buffer = ""
			return
		}

		// Handle newlines
		let lineEndIndex: number
		while ((lineEndIndex = this.buffer.indexOf("\n")) !== -1) {
			const line = this.buffer.slice(0, lineEndIndex).trim()
			if (line) {
				await this.queueOutput(line, terminalId)
			}
			this.buffer = this.buffer.slice(lineEndIndex + 1)
		}

		// If we have content in buffer without any line endings,
		// and it's a complete line, emit it
		if (this.buffer.trim()) {
			await this.queueOutput(this.buffer.trim(), terminalId)
			this.buffer = ""
		}
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
