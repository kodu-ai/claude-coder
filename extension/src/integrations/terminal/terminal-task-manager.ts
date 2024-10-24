import { EventEmitter } from "events"
import * as vscode from "vscode"
import { arePathsEqual } from "../../utils/path-helpers"
import stripAnsi from "strip-ansi"

export interface TaskInfo {
	task: vscode.Task
	execution?: vscode.TaskExecution
	terminal?: vscode.Terminal
	busy: boolean
	lastCommand: string
	id: number
	name?: string
}

export interface DevServerInfo {
	taskInfo: TaskInfo
	url: string | null
}

export class TaskRegistry {
	private static tasks: TaskInfo[] = []
	private static nextTaskId = 1
	private static devServers: DevServerInfo[] = []

	static createTask(command: string, cwd?: string, name?: string): TaskInfo {
		const taskDefinition: vscode.TaskDefinition = {
			type: "shell",
		}

		const shellExecution = new vscode.ShellExecution(command, { cwd })

		const task = new vscode.Task(
			taskDefinition,
			vscode.TaskScope.Workspace,
			name || "Kodu.AI",
			"kodu",
			shellExecution
		)

		const terminal = vscode.window.createTerminal({
			name: `Task Terminal: ${name || "Kodu.AI"}`,
			cwd,
		})

		const newInfo: TaskInfo = {
			task,
			terminal,
			busy: false,
			lastCommand: command,
			id: this.nextTaskId++,
			name,
		}

		this.tasks.push(newInfo)
		return newInfo
	}

	static getTask(id: number): TaskInfo | undefined {
		return this.tasks.find((t) => t.id === id)
	}

	static getTaskByName(name: string): TaskInfo | undefined {
		return this.tasks.find((t) => t.name === name)
	}

	static updateTask(id: number, updates: Partial<TaskInfo>) {
		const task = this.getTask(id)
		if (task) {
			Object.assign(task, updates)
		}
	}

	static removeTask(id: number) {
		const task = this.getTask(id)
		if (task && task.terminal) {
			task.terminal.dispose()
		}
		this.tasks = this.tasks.filter((t) => t.id !== id)
		this.devServers = this.devServers.filter((ds) => ds.taskInfo.id !== id)
	}

	static getAllTasks(): TaskInfo[] {
		return this.tasks
	}

	static addDevServer(taskInfo: TaskInfo, url: string | null = null) {
		this.devServers.push({ taskInfo, url })
	}

	static updateDevServerUrl(taskId: number, url: string) {
		const devServer = this.devServers.find((ds) => ds.taskInfo.id === taskId)
		if (devServer) {
			devServer.url = url
		}
	}

	static getDevServer(taskId: number): DevServerInfo | undefined {
		return this.devServers.find((ds) => ds.taskInfo.id === taskId)
	}

	static getDevServerByName(name: string): DevServerInfo | undefined {
		const taskInfo = this.getTaskByName(name)
		if (taskInfo) {
			return this.getDevServer(taskInfo.id)
		}
		return undefined
	}

	static getAllDevServers(): DevServerInfo[] {
		return this.devServers
	}

	static removeDevServer(taskId: number) {
		this.devServers = this.devServers.filter((ds) => ds.taskInfo.id !== taskId)
	}

	static clearDevServer(taskId: number) {
		const taskInfo = this.getTask(taskId)
		if (taskInfo) {
			if (taskInfo.execution) {
				taskInfo.execution.terminate()
			}
			if (taskInfo.terminal) {
				taskInfo.terminal.dispose()
			}
		}
		this.removeDevServer(taskId)
	}

	static clearAllDevServers() {
		for (const devServer of this.devServers) {
			this.clearDevServer(devServer.taskInfo.id)
		}
	}
}

export class TaskProcess extends EventEmitter {
	private isListening: boolean = true
	private buffer: string = ""
	private fullOutput: string[] = []
	private lastRetrievedLineIndex: number = 0
	isHot: boolean = false
	private pollInterval?: NodeJS.Timeout
	private processId?: number
	public isCompleted: boolean = false

	async run(taskInfo: TaskInfo, command: string) {
		if (!taskInfo || typeof taskInfo.id !== "number") {
			throw new Error("Invalid task info provided")
		}

		this.isHot = true

		try {
			if (taskInfo.terminal) {
				taskInfo.terminal.show(true)

				// Get the process ID for polling
				this.processId = await taskInfo.terminal.processId

				// Start polling for process status
				this.startPolling(taskInfo.terminal)

				// Execute the command
				taskInfo.terminal.sendText(command, true)
			}

			// Execute task
			taskInfo.execution = await vscode.tasks.executeTask(taskInfo.task)

			// Wait for task completion
			await new Promise<void>((resolve, reject) => {
				const processEndDisposable = vscode.tasks.onDidEndTaskProcess((e) => {
					if (e.execution === taskInfo.execution) {
						this.stopPolling()
						processEndDisposable.dispose()

						if (e.exitCode === 0) {
							resolve()
						} else {
							reject(new Error(`Task failed with exit code ${e.exitCode}`))
						}
					}
				})

				const taskEndDisposable = vscode.tasks.onDidEndTask((e) => {
					if (e.execution === taskInfo.execution) {
						this.stopPolling()
						taskEndDisposable.dispose()
						processEndDisposable.dispose()
						resolve()
					}
				})
			})
		} catch (error) {
			this.stopPolling()
			this.emit("error", error instanceof Error ? error : new Error(String(error)))
		} finally {
			this.stopPolling()
			this.isHot = false
			this.emitRemainingBufferIfListening()
			this.isListening = false
			this.emit("completed")
			this.emit("continue")
			this.isCompleted = true
		}
	}

	private startPolling(terminal: vscode.Terminal) {
		// Poll every 100ms for output
		this.pollInterval = setInterval(async () => {
			try {
				if (this.processId) {
					// Check if process is still running
					const processes = await vscode.window.terminals
					const isRunning = processes.some((t) => t === terminal)

					if (!isRunning) {
						this.stopPolling()
						this.emit("completed")
						return
					}

					// Process output
					const output = await this.getTerminalOutput(terminal)
					if (output) {
						this.processDataChunk(output)
					}
				}
			} catch (error) {
				console.error("Polling error:", error)
			}
		}, 100)
	}

	private stopPolling() {
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
			this.pollInterval = undefined
		}
	}

	private async getTerminalOutput(terminal: vscode.Terminal): Promise<string> {
		// This is a placeholder - in a real implementation you might need to
		// use other VSCode APIs or system-specific approaches to get terminal output
		return ""
	}

	private processDataChunk(data: string) {
		const cleanData = stripAnsi(data)
		if (cleanData.trim()) {
			this.emitIfEol(cleanData)
		}
	}

	private emitIfEol(chunk: string) {
		this.buffer += chunk
		let lineEndIndex: number
		while ((lineEndIndex = this.buffer.indexOf("\n")) !== -1) {
			const line = this.buffer.slice(0, lineEndIndex).trimEnd()
			this.emit("line", line)
			this.fullOutput.push(line)
			this.buffer = this.buffer.slice(lineEndIndex + 1)
		}
	}

	private emitRemainingBufferIfListening() {
		if (this.buffer && this.isListening) {
			const remainingBuffer = this.buffer.trim()
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

export type TaskProcessResultPromise = TaskProcess & Promise<void>

export function mergePromise(process: TaskProcess, promise: Promise<void>): TaskProcessResultPromise {
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
	return process as TaskProcessResultPromise
}

export class TerminalTaskManager {
	private taskIds: Set<number> = new Set()
	private processes: Map<number, TaskProcess> = new Map()
	private disposables: vscode.Disposable[] = []

	constructor() {
		const taskEndDisposable = vscode.tasks.onDidEndTask((e) => {
			const taskInfo = TaskRegistry.getAllTasks().find((t) => t.execution === e.execution)
			if (taskInfo) {
				this.taskIds.delete(taskInfo.id)
				this.processes.delete(taskInfo.id)
				TaskRegistry.removeTask(taskInfo.id)
			}
		})
		this.disposables.push(taskEndDisposable)
	}

	async runCommand(taskInfo: TaskInfo, command: string, options?: { autoClose?: boolean }) {
		if (!taskInfo || typeof taskInfo.id !== "number") {
			throw new Error("Invalid task info provided to runCommand")
		}

		taskInfo.busy = true
		taskInfo.lastCommand = command

		// Create a new task for the command
		const newTaskInfo = TaskRegistry.createTask(command, taskInfo.task.definition.options?.cwd, taskInfo.name)

		const process = new TaskProcess()
		this.processes.set(newTaskInfo.id, process)

		process.once("completed", () => {
			taskInfo.busy = false
			if (options?.autoClose) {
				this.closeTask(newTaskInfo.id)
			}
		})

		const promise = new Promise<void>((resolve, reject) => {
			process.once("continue", () => resolve())
			process.once("error", (error) => reject(error))
		})

		process.run(newTaskInfo, command)

		return process
	}

	async getOrCreateTask(cwd: string, name?: string): Promise<TaskInfo> {
		const availableTask = TaskRegistry.getAllTasks().find((t) => {
			if (t.busy) return false
			if (name && t.name === name) return true
			return arePathsEqual(vscode.Uri.file(cwd).fsPath, t.task.definition.options?.cwd)
		})

		if (availableTask) {
			this.taskIds.add(availableTask.id)
			return availableTask
		}

		const newTaskInfo = TaskRegistry.createTask("", cwd, name)
		if (!newTaskInfo || typeof newTaskInfo.id !== "number") {
			throw new Error("Failed to create new task")
		}

		this.taskIds.add(newTaskInfo.id)
		return newTaskInfo
	}

	getTasks(busy: boolean): { id: number; name?: string; lastCommand: string }[] {
		return Array.from(this.taskIds)
			.map((id) => TaskRegistry.getTask(id))
			.filter((t): t is TaskInfo => t !== undefined && t.busy === busy)
			.map((t) => ({ id: t.id, name: t.name, lastCommand: t.lastCommand }))
	}

	getUnretrievedOutput(taskId: number, updateRetrievedIndex: boolean = true): string {
		const process = this.processes.get(taskId)
		return process ? process.getUnretrievedOutput(updateRetrievedIndex) : ""
	}

	getPartialOutput(taskId: number, fromLineIndex: number, toLineIndex?: number): string {
		const process = this.processes.get(taskId)
		return process ? process.getOutput(fromLineIndex, toLineIndex).join("\n") : ""
	}

	getFullOutput(taskId: number): string {
		const process = this.processes.get(taskId)
		return process ? process.getFullOutput().join("\n") : ""
	}

	isProcessHot(taskId: number): boolean {
		const process = this.processes.get(taskId)
		return process ? process.isHot : false
	}

	closeTask(id: number): boolean {
		const taskInfo = TaskRegistry.getTask(id)
		if (taskInfo) {
			if (taskInfo.execution) {
				taskInfo.execution.terminate()
			}
			if (taskInfo.terminal) {
				taskInfo.terminal.dispose()
			}
			TaskRegistry.removeTask(id)
			this.taskIds.delete(id)
			this.processes.delete(id)
			return true
		}
		return false
	}

	closeAllTasks(): void {
		for (const id of Array.from(this.taskIds)) {
			this.closeTask(id)
		}
	}

	disposeAll() {
		this.closeAllTasks()
		this.taskIds.clear()
		this.processes.clear()
		this.disposables.forEach((disposable) => disposable.dispose())
		this.disposables = []
	}
}
