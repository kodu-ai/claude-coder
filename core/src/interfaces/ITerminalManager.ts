import { ShellIntegration, TerminalEventListener, TerminalExitStatus } from "@/types"

// Main terminal interface to replace vscode.Terminal
export interface ITerminal {
	name: string
	shellIntegration?: ShellIntegration
	exitStatus?: TerminalExitStatus
	sendText(text: string, addNewLine?: boolean): void
	dispose(): void
	show(): void
}

// Window interface for terminal creation and events
export interface ITerminalWindow {
	createTerminal(options: { cwd?: string | IUri; name?: string }): ITerminal
	onDidCloseTerminal(listener: TerminalEventListener): IDisposable
}

// Disposable interface
export interface IDisposable {
	dispose(): void
}

// Interface representing a URI/path
export interface IUri {
	fsPath: string
}
