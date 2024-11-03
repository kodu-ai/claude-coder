import { EventEmitter } from "events"
import * as vscode from "vscode"
import { arePathsEqual } from "../../utils/path-helpers"
import delay from "delay"

// Custom error types for better error handling
export class ShellIntegrationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "ShellIntegrationError"
	}
}

export class TerminalError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "TerminalError"
	}
}

// Terminal process state and output management
export interface TerminalOutput {
	lines: string[]
	lastRetrievedIndex: number
}

export interface TerminalInfo {
	terminal: vscode.Terminal
	busy: boolean
	lastCommand: string
	id: number
	name?: string
	output: TerminalOutput
}

export interface TerminalExecutionResult {
	exitCode: number | undefined
	output: string[]
}

// Events interface for strongly typed events
interface TerminalEvents {
	output: (output: string) => void
	exit: (code: number | undefined) => void
	error: (error: Error) => void
}

/**
 * Enhanced terminal manager with native VSCode shell integration
 */
export class NewTerminalManager {
	private static instance: NewTerminalManager
	private terminals: Map<number, TerminalInfo> = new Map()
	private nextTerminalId: number = 1
	private disposables: vscode.Disposable[] = []
	private eventEmitter = new EventEmitter()

	private constructor() {
		this.setupEventListeners()
	}

	public static getInstance(): NewTerminalManager {
		if (!NewTerminalManager.instance) {
			NewTerminalManager.instance = new NewTerminalManager()
		}
		return NewTerminalManager.instance
	}

	private setupEventListeners(): void {
		// Handle terminal closure
		this.disposables.push(
			vscode.window.onDidCloseTerminal((terminal) => {
				for (const [id, info] of this.terminals) {
					if (info.terminal === terminal) {
						this.terminals.delete(id)
						break
					}
				}
			})
		)

		// Handle shell integration changes
		this.disposables.push(
			vscode.window.onDidChangeTerminalShellIntegration(({ terminal }) => {
				// Update terminal info if needed
				for (const info of this.terminals.values()) {
					if (info.terminal === terminal) {
						// Terminal now has shell integration
						this.eventEmitter.emit("shellIntegrationAvailable", info)
						break
					}
				}
			})
		)
	}

	/**
	 * Creates a new terminal or returns an existing one
	 */
	public async createTerminal(options: { cwd?: string; name?: string }): Promise<TerminalInfo> {
		const terminal = vscode.window.createTerminal({
			cwd: options.cwd,
			name: options.name || "Terminal",
		})

		const terminalInfo: TerminalInfo = {
			terminal,
			busy: false,
			lastCommand: "",
			id: this.nextTerminalId++,
			name: options.name,
			output: {
				lines: [],
				lastRetrievedIndex: 0,
			},
		}

		this.terminals.set(terminalInfo.id, terminalInfo)
		terminal.show()

		// Wait for shell integration with timeout
		try {
			await this.waitForShellIntegration(terminal)
		} catch (error) {
			// @ts-expect-error
			console.warn(`Shell integration not available: ${error.message}`)
		}

		return terminalInfo
	}

	/**
	 * Executes a command in the specified terminal
	 */
	public async executeCommand(terminalId: number, command: string): Promise<TerminalExecutionResult> {
		const terminalInfo = this.terminals.get(terminalId)
		if (!terminalInfo) {
			throw new TerminalError(`Terminal ${terminalId} not found`)
		}

		if (terminalInfo.busy) {
			throw new TerminalError(`Terminal ${terminalId} is busy`)
		}

		terminalInfo.busy = true
		terminalInfo.lastCommand = command
		const outputLines: string[] = []

		try {
			if (!terminalInfo.terminal.shellIntegration) {
				throw new ShellIntegrationError("Shell integration not available")
			}

			let exitCodeResolved = false
			const exitCodePromise = new Promise<number | undefined>((resolve) => {
				const disposable = vscode.window.onDidEndTerminalShellExecution(async (e) => {
					if (e.execution === execution) {
						disposable.dispose()
						exitCodeResolved = true
						resolve(e.exitCode)
					}
				})
			})

			terminalInfo.terminal.show()
			const execution = terminalInfo.terminal.shellIntegration.executeCommand(command)
			const stream = execution.read()
			const reader = stream[Symbol.asyncIterator]()

			while (!exitCodeResolved) {
				const { value: data, done } = await reader.next()

				if (done) {
					break
				}

				const lines = data
					.split("\n")
					.map((line) => line.trim())
					.filter(Boolean)

				outputLines.push(...lines)

				// Update terminal output
				terminalInfo.output.lines.push(...lines)

				// Emit output events
				lines.forEach((line) => this.eventEmitter.emit("output", line))

				// temporary log
				this.eventEmitter.emit("output", data)
				outputLines.push(data)
			}

			return {
				exitCode: await exitCodePromise,
				output: outputLines,
			}
		} catch (error) {
			throw new TerminalError(`Command execution failed: ${error}`)
		} finally {
			terminalInfo.busy = false
		}
	}
	/**
	 * Waits for shell integration to become available
	 */
	private async waitForShellIntegration(terminal: vscode.Terminal): Promise<void> {
		return new Promise((resolve, reject) => {
			if (terminal.shellIntegration) {
				resolve()
				return
			}

			const timeout = setTimeout(() => {
				disposable.dispose()
				reject(new Error("Shell integration timeout"))
			}, 10000)

			const disposable = vscode.window.onDidChangeTerminalShellIntegration((event) => {
				if (event.terminal === terminal) {
					clearTimeout(timeout)
					disposable.dispose()
					resolve()
				}
			})
		})
	}

	/**
	 * Gets terminal output from line X to Y
	 */
	public getOutput(terminalId: number, fromLine: number, toLine?: number): string[] {
		const terminalInfo = this.terminals.get(terminalId)
		if (!terminalInfo) {
			throw new TerminalError(`Terminal ${terminalId} not found`)
		}

		const { lines } = terminalInfo.output
		const start = Math.max(0, fromLine)
		const end = toLine ? Math.min(lines.length, toLine) : lines.length

		return lines.slice(start, end)
	}

	/**
	 * Gets all terminal output
	 */
	public getAllOutput(terminalId: number): string[] {
		const terminalInfo = this.terminals.get(terminalId)
		if (!terminalInfo) {
			throw new TerminalError(`Terminal ${terminalId} not found`)
		}

		return [...terminalInfo.output.lines]
	}

	/**
	 * Gets the latest terminal output
	 */
	public getLatestOutput(terminalId: number, lineCount: number = 10): string[] {
		const terminalInfo = this.terminals.get(terminalId)
		if (!terminalInfo) {
			throw new TerminalError(`Terminal ${terminalId} not found`)
		}

		const { lines } = terminalInfo.output
		return lines.slice(-lineCount)
	}

	/**
	 * Subscribes to terminal events
	 */
	public on<K extends keyof TerminalEvents>(event: K, listener: TerminalEvents[K]): void {
		this.eventEmitter.on(event, listener)
	}

	/**
	 * Unsubscribes from terminal events
	 */
	public off<K extends keyof TerminalEvents>(event: K, listener: TerminalEvents[K]): void {
		this.eventEmitter.off(event, listener)
	}

	/**
	 * Disposes the terminal manager and all terminals
	 */
	public dispose(): void {
		for (const [id, info] of this.terminals) {
			info.terminal.dispose()
			this.terminals.delete(id)
		}

		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
		this.eventEmitter.removeAllListeners()
	}
}

/**
 * Dev terminal manager for managing development servers
 */
export class DevTerminalManager {
	private terminalManager: NewTerminalManager
	private devServers: Map<
		string,
		{
			terminalId: number
			url: string | null
			status: "starting" | "running" | "stopped" | "error"
			error?: string
		}
	> = new Map()

	constructor() {
		this.terminalManager = NewTerminalManager.getInstance()
	}

	/**
	 * Starts a development server
	 */
	public async startDevServer(name: string, command: string, cwd?: string): Promise<void> {
		// Create a dedicated terminal for the dev server
		const terminalInfo = await this.terminalManager.createTerminal({
			name: `Dev Server: ${name}`,
			cwd,
		})

		this.devServers.set(name, {
			terminalId: terminalInfo.id,
			url: null,
			status: "starting",
		})

		try {
			const result = await this.terminalManager.executeCommand(terminalInfo.id, command)

			if (result.exitCode === 0) {
				this.devServers.get(name)!.status = "running"
			} else {
				this.devServers.get(name)!.status = "error"
				this.devServers.get(name)!.error = `Server exited with code ${result.exitCode}`
			}
		} catch (error) {
			this.devServers.get(name)!.status = "error"
			// @ts-expect-error
			this.devServers.get(name)!.error = error.message
			throw error
		}
	}

	/**
	 * Stops a development server
	 */
	public async stopDevServer(name: string): Promise<void> {
		const server = this.devServers.get(name)
		if (!server) {
			throw new Error(`Dev server ${name} not found`)
		}

		const terminalInfo = this.terminalManager.executeCommand(server.terminalId, "\x03") // Send SIGINT
		this.devServers.get(name)!.status = "stopped"
	}

	/**
	 * Gets the status of a development server
	 */
	public getServerStatus(name: string): { status: string; error?: string } {
		const server = this.devServers.get(name)
		if (!server) {
			throw new Error(`Dev server ${name} not found`)
		}

		return {
			status: server.status,
			error: server.error,
		}
	}

	/**
	 * Gets all development server logs
	 */
	public getServerLogs(name: string): string[] {
		const server = this.devServers.get(name)
		if (!server) {
			throw new Error(`Dev server ${name} not found`)
		}

		return this.terminalManager.getAllOutput(server.terminalId)
	}

	/**
	 * Disposes all development servers
	 */
	public dispose(): void {
		for (const [name, server] of this.devServers) {
			this.stopDevServer(name).catch(console.error)
		}
		this.devServers.clear()
	}
}
