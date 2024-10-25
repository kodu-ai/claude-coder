import { TerminalProcess } from "@/integrations"
import { ITerminal, IUri } from "@/interfaces"

// Helper class to create URIs
export class UriImpl implements IUri {
	constructor(public fsPath: string) {}

	static file(path: string): IUri {
		return new UriImpl(path)
	}
}

// Event handler types
export interface TerminalDisposedEvent {
	terminal: ITerminal
}

export type TerminalEventListener = (event: TerminalDisposedEvent) => void

// Interface for shell integration
export interface ShellIntegration {
	cwd?: IUri
	executeCommand?: (command: string) => CommandExecution
}

// Interface for command execution result
export interface CommandExecution {
	read(): AsyncIterable<string>
}

// Interface for terminal exit status
export interface TerminalExitStatus {
	code: number | undefined
}

export interface TerminalInfo {
	terminal: ITerminal
	busy: boolean
	lastCommand: string
	id: number
	name?: string
}

export interface DevServerInfo {
	terminalInfo: TerminalInfo
	url: string | null
	logs: string[]
	status: "starting" | "running" | "stopped" | "error"
	error?: string
}

export interface TerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: []
	error: [error: Error]
	no_shell_integration: []
}

export type TerminalProcessResultPromise = TerminalProcess & Promise<void>
