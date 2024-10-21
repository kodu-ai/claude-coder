import { EventEmitter } from "events"
import pWaitFor from "p-wait-for"
import stripAnsi from "strip-ansi"
import * as vscode from "vscode"
import { arePathsEqual } from "../../utils/path-helpers"

/*
TerminalManager:
- Creates/reuses terminals
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

Notes:
- Some shellIntegration APIs are available on cursor, although not on older versions of vscode
- "By default, the shell integration script should automatically activate on supported shells launched from VS Code."
Supported shells:
Linux/macOS: bash, fish, pwsh, zsh
Windows: pwsh

Resources:
- https://github.com/microsoft/vscode/issues/226655
- https://code.visualstudio.com/updates/v1_93#_terminal-shell-integration-api
- https://code.visualstudio.com/docs/terminal/shell-integration
- https://code.visualstudio.com/api/references/vscode-api#Terminal
- https://github.com/microsoft/vscode-extension-samples/blob/main/terminal-sample/src/extension.ts
- https://github.com/microsoft/vscode-extension-samples/blob/main/shell-integration-sample/src/extension.ts
*/

/*
The new shellIntegration API gives us access to terminal command execution output handling.
However, we don't update our VSCode type definitions or engine requirements to maintain compatibility
with older VSCode versions. Users on older versions will automatically fall back to using sendText
for terminal command execution.
Interestingly, some environments like Cursor enable these APIs even without the latest VSCode engine.
This approach allows us to leverage advanced features when available while ensuring broad compatibility.
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
}

// TerminalRegistry class to manage terminals
export class TerminalRegistry {
	private static terminals: TerminalInfo[] = []
	private static nextTerminalId = 1

	static createTerminal(cwd?: string | vscode.Uri | undefined): TerminalInfo {
		const terminal = vscode.window.createTerminal({
			cwd,
			name: "Kodu.AI",
		})
		const newInfo: TerminalInfo = {
			terminal,
			busy: false,
			lastCommand: "",
			id: this.nextTerminalId++,
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
	}

	static getAllTerminals(): TerminalInfo[] {
		this.terminals = this.terminals.filter((t) => !this.isTerminalClosed(t.terminal))
		return this.terminals
	}

	// The exit status of the terminal will be undefined while the terminal is active. (This value is set when onDidCloseTerminal is fired.)
	private static isTerminalClosed(terminal: vscode.Terminal): boolean {
		return terminal.exitStatus !== undefined
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

		// if shell integration is not available, remove terminal so it does not get reused as it may be running a long-running process
		process.once("no_shell_integration", () => {
			console.log(`no_shell_integration received for terminal ${terminalInfo.id}`)
			// Remove the terminal so we can't reuse it (in case it's running a long-running process)
			TerminalRegistry.removeTerminal(terminalInfo.id)
			this.terminalIds.delete(terminalInfo.id)
			this.processes.delete(terminalInfo.id)
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

		// if shell integration is already active, run the command immediately
		if (terminalInfo.terminal.shellIntegration) {
			process.waitForShellIntegration = false
			process.run(terminalInfo.terminal, command)
		} else {
			// docs recommend waiting 3s for shell integration to activate
			pWaitFor(() => terminalInfo.terminal.shellIntegration !== undefined, { timeout: 4000 }).finally(() => {
				const existingProcess = this.processes.get(terminalInfo.id)
				if (existingProcess && existingProcess.waitForShellIntegration) {
					existingProcess.waitForShellIntegration = false
					existingProcess.run(terminalInfo.terminal, command)
				}
			})
		}

		return mergePromise(process, promise)
	}

	async getOrCreateTerminal(cwd: string): Promise<TerminalInfo> {
		// Find available terminal from our pool first (created for this task)
		const availableTerminal = TerminalRegistry.getAllTerminals().find(async (t) => {
			if (t.busy) {
				return false
			}
			let terminalCwd = t.terminal.shellIntegration?.cwd // one of cline's commands could have changed the cwd of the terminal
			// const result = this.runCommand(t, "pwd", { autoClose: false })
			// await result
			// const pwd = result.getFullOutput()
			if (!terminalCwd) {
				return false
			}
			// if (!terminalCwd && pwd.includes(cwd)) {
			// 	return true
			// }
			return arePathsEqual(vscode.Uri.file(cwd).fsPath, terminalCwd?.fsPath)
		})
		if (availableTerminal) {
			this.terminalIds.add(availableTerminal.id)
			return availableTerminal
		}

		const newTerminalInfo = TerminalRegistry.createTerminal(cwd)
		this.terminalIds.add(newTerminalInfo.id)
		return newTerminalInfo
	}

	getTerminals(busy: boolean): { id: number; lastCommand: string }[] {
		return Array.from(this.terminalIds)
			.map((id) => TerminalRegistry.getTerminal(id))
			.filter((t): t is TerminalInfo => t !== undefined && t.busy === busy)
			.map((t) => ({ id: t.id, lastCommand: t.lastCommand }))
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

interface TerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: []
	error: [error: Error]
	no_shell_integration: []
}

const PROCESS_HOT_TIMEOUT_NORMAL = 2_000
const PROCESS_HOT_TIMEOUT_COMPILING = 15_000

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
	private hotTimer: NodeJS.Timeout | null = null

	async run(terminal: vscode.Terminal, command: string) {
		if (terminal.shellIntegration && terminal.shellIntegration.executeCommand) {
			const execution = terminal.shellIntegration.executeCommand(command)
			const stream = execution.read()
			let isFirstChunk = true
			let didOutputNonCommand = false
			let didEmitEmptyLine = false

			for await (let data of stream) {
				// Log the raw data for debugging
				console.log("Raw data chunk:", JSON.stringify(data))

				// Strip ANSI escape codes and VSCode shell integration sequences
				data = this.cleanDataChunk(data)

				// If after cleaning, data is empty, continue to the next chunk
				if (!data.trim()) {
					continue
				}

				// Process the data chunk
				this.processDataChunk(data, command, isFirstChunk)
				isFirstChunk = false

				// Handle "hot" state based on output
				this.updateHotState(data)

				// Emit an empty line to indicate the start of command output
				if (!didEmitEmptyLine && this.fullOutput.length === 0) {
					this.emit("line", "")
					didEmitEmptyLine = true
				}
			}

			this.emitRemainingBufferIfListening()

			// Reset hot state
			if (this.hotTimer) {
				clearTimeout(this.hotTimer)
			}
			this.isHot = false

			this.emit("completed")
			this.emit("continue")
		} else {
			terminal.sendText(command, true)
			this.emit("completed")
			this.emit("continue")
			this.emit("no_shell_integration")
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

	private updateHotState(data: string) {
		// Set isHot to true and reset timer
		this.isHot = true
		if (this.hotTimer) {
			clearTimeout(this.hotTimer)
		}

		const compilingMarkers = ["compiling", "building", "bundling", "transpiling", "generating", "starting"]
		const markerNullifiers = [
			"compiled",
			"success",
			"finish",
			"complete",
			"succeed",
			"done",
			"end",
			"stop",
			"exit",
			"terminate",
			"error",
			"fail",
		]
		const isCompiling =
			compilingMarkers.some((marker) => data.toLowerCase().includes(marker.toLowerCase())) &&
			!markerNullifiers.some((nullifier) => data.toLowerCase().includes(nullifier.toLowerCase()))

		this.hotTimer = setTimeout(
			() => {
				this.isHot = false
			},
			isCompiling ? PROCESS_HOT_TIMEOUT_COMPILING : PROCESS_HOT_TIMEOUT_NORMAL
		)
	}

	private emitIfEol(chunk: string) {
		this.buffer += chunk
		let lineEndIndex: number
		while ((lineEndIndex = this.buffer.indexOf("\n")) !== -1) {
			let line = this.buffer.slice(0, lineEndIndex).trimEnd() // removes trailing \r
			line = this.removeLastLineArtifacts(line)
			this.emit("line", line)
			this.fullOutput.push(line)
			this.buffer = this.buffer.slice(lineEndIndex + 1)
		}
	}

	private emitRemainingBufferIfListening() {
		if (this.buffer && this.isListening) {
			const remainingBuffer = this.removeLastLineArtifacts(this.buffer)
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

	// Remove artifacts like shell prompts from the line
	removeLastLineArtifacts(line: string): string {
		// Remove common shell prompts from the line
		const promptRegex = /^[^\w\n]*([\s\S]*?)[^\w\n]*[%$#>]?\s*$/
		const match = line.match(promptRegex)
		if (match) {
			return match[1]
		}
		return line
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
