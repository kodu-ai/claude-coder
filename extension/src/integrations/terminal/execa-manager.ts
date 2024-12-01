import { EventEmitter } from "events"
import * as vscode from "vscode"
import path from "path"
import { execa, type ResultPromise } from "execa"

// Helper function to compare paths
export function arePathsEqual(path1: string, path2: string): boolean {
	return path.normalize(path1).toLowerCase() === path.normalize(path2).toLowerCase()
}

export interface TerminalInfo {
	id: number
	busy: boolean
	lastCommand: string
	name?: string
	cwd: string
	process?: ResultPromise
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

	static createTerminal(cwd: string, name?: string): TerminalInfo {
		const newInfo: TerminalInfo = {
			cwd,
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
		return this.terminals.find((t) => t.id === id)
	}

	static getTerminalByName(name: string): TerminalInfo | undefined {
		return this.terminals.find((t) => t.name === name)
	}

	static closeTerminal(id: number): boolean {
		const terminalInfo = this.getTerminal(id)
		if (terminalInfo) {
			terminalInfo.process?.kill()
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
		const terminal = this.getTerminal(id)
		if (terminal?.process) {
			terminal.process.kill()
		}
		this.terminals = this.terminals.filter((t) => t.id !== id)
		this.devServers = this.devServers.filter((ds) => ds.terminalInfo.id !== id)
		this.terminalOutputMap.delete(id)
		this.outputBuffers.delete(id)
	}

	static getAllTerminals(): TerminalInfo[] {
		return this.terminals
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
		return !!devServer && devServer.status === "running"
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
		// Listen for VS Code window close event to clean up terminals
		const disposable = vscode.workspace.onDidCloseTextDocument(() => {
			this.closeAllTerminals()
		})
		this.disposables.push(disposable)
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

		const promise = process.run(command, terminalInfo)

		return mergePromise(process, promise)
	}

	async getOrCreateTerminal(cwd: string, name?: string): Promise<TerminalInfo> {
		// Find available terminal
		const availableTerminal = TerminalRegistry.getAllTerminals().find((t) => {
			if (t.busy) {return false}
			if (name && t.name === name) {return true}
			return arePathsEqual(t.cwd, cwd)
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
		if (!this.terminalIds.has(terminalId)) {return ""}
		const process = this.processes.get(terminalId)
		return process ? process.getUnretrievedOutput(updateRetrievedIndex) : ""
	}

	getPartialOutput(terminalId: number, fromLineIndex: number, toLineIndex?: number): string {
		if (!this.terminalIds.has(terminalId)) {return ""}
		const process = this.processes.get(terminalId)
		return process ? process.getOutput(fromLineIndex, toLineIndex).join("\n") : ""
	}

	getFullOutput(terminalId: number): string {
		if (!this.terminalIds.has(terminalId)) {return ""}
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

interface TerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: []
	error: [error: Error]
}

export class TerminalProcess extends EventEmitter<TerminalProcessEvents> {
	private isListening: boolean = true
	private fullOutput: string[] = []
	private lastRetrievedLineIndex: number = 0
	isHot: boolean = false
	private currentProcess?: ResultPromise

	async run(command: string, terminalInfo: TerminalInfo): Promise<void> {
		this.isHot = true

		try {
			// Create shell-specific command array
			const shellCmd = process.platform === "win32" ? ["cmd", "/c"] : ["sh", "-c"]
			const subprocess = execa(shellCmd[0], [...shellCmd.slice(1), command], {
				cwd: terminalInfo.cwd,
				env: process.env,
				stripFinalNewline: false,
				buffer: false, // Stream output instead of buffering
			})

			terminalInfo.process = subprocess
			this.currentProcess = subprocess

			// Handle stdout
			subprocess.stdout?.on("data", (data: Buffer) => {
				const lines = data.toString().split("\n")
				for (const line of lines) {
					if (line.trim()) {
						this.emit("line", line)
						this.fullOutput.push(line)
						TerminalRegistry.addOutput(terminalInfo.id, line + "\n")
					}
				}
			})

			// Handle stderr
			subprocess.stderr?.on("data", (data: Buffer) => {
				const lines = data.toString().split("\n")
				for (const line of lines) {
					if (line.trim()) {
						this.emit("line", line)
						this.fullOutput.push(line)
						TerminalRegistry.addOutput(terminalInfo.id, line + "\n")
					}
				}
			})

			// Wait for process to complete
			await subprocess
		} catch (error) {
			if (!this.currentProcess?.killed) {
				// Only emit error if process wasn't manually killed
				this.emit("error", error as Error)
				console.error(`Error in terminal process:`, error)
				throw error
			}
		} finally {
			this.isHot = false
			this.isListening = false
			this.emit("completed")
			this.emit("continue")
		}
	}

	continue() {
		if (this.currentProcess && !this.currentProcess.killed) {
			this.currentProcess.kill()
		}
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
