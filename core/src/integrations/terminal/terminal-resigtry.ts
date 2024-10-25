import * as vscode from "vscode"
import { DevServerInfo, TerminalInfo } from "./terminal-manager"

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
