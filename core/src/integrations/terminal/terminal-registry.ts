import { DevServerInfo, TerminalInfo } from "@/types"
import { ITerminal, ITerminalWindow, IUri } from "@/interfaces"

export class TerminalRegistry {
	private static terminals: TerminalInfo[] = []
	private static nextTerminalId = 1
	private static devServers: DevServerInfo[] = []
	private static terminalOutputMap: Map<number, string[]> = new Map()
	private static outputBuffers: Map<number, string> = new Map()
	private static window: ITerminalWindow

	static initialize(window: ITerminalWindow) {
		this.window = window
	}

	static createTerminal(cwd?: string | IUri | undefined, name?: string): TerminalInfo {
		const terminal = this.window.createTerminal({
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

	static getTerminalByName(name: string): TerminalInfo | undefined {
		const terminalInfo = this.terminals.find((t) => t.name === name)
		if (terminalInfo && this.isTerminalClosed(terminalInfo.terminal)) {
			this.removeTerminal(terminalInfo.id)
			return undefined
		}
		return terminalInfo
	}

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

	private static isTerminalClosed(terminal: ITerminal): boolean {
		return terminal.exitStatus !== undefined
	}

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
