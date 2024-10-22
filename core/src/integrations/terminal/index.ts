import * as vscode from "vscode" // TODO: refactor
import { ExecaTerminalManager } from "./execa-terminal-manager"
import { TerminalManager as AdvancedTerminalManager } from "./terminal-manager"

export interface ITerminalManager {
	runCommand(terminalInfo: TerminalInfo, command: string): TerminalProcessResultPromise
	getOrCreateTerminal(cwd: string): Promise<TerminalInfo>
	getTerminals(busy: boolean): { id: number; lastCommand: string }[]
	getUnretrievedOutput(terminalId: number): string
	isProcessHot(terminalId: number): boolean
	disposeAll(): void
}

export interface TerminalInfo {
	terminal: vscode.Terminal
	busy: boolean
	lastCommand: string
	id: number
	cwd: string
}

export interface TerminalProcessResultPromise extends Promise<void> {
	on(event: string, listener: (...args: any[]) => void): this
	once(event: string, listener: (...args: any[]) => void): this
	emit(event: string, ...args: any[]): boolean
	continue(): void
	getUnretrievedOutput(): string
	isHot: boolean
}

export function createTerminalManager(useAdvanced: boolean, context: vscode.ExtensionContext) {
	if (useAdvanced) {
		return new AdvancedTerminalManager()
	} else {
		return new ExecaTerminalManager()
	}
}

// Export other necessary types and interfaces
export { TerminalManager as AdvancedTerminalManager } from "./terminal-manager"
export * from "./execa-terminal-manager"
export * from "./terminal-manager"