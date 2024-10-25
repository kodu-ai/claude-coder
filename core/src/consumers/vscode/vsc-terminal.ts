import * as vscode from "vscode"
import { ITerminal, IUri, ITerminalWindow, IDisposable } from "@/interfaces"
import { ShellIntegration, TerminalExitStatus, CommandExecution, TerminalEventListener } from "@/types"
import { TerminalManager } from "@/integrations"

export class VSCodeTerminalImpl implements ITerminal {
	private terminal: vscode.Terminal

	constructor(terminal: vscode.Terminal) {
		this.terminal = terminal
	}

	get name(): string {
		return this.terminal.name
	}

	get shellIntegration(): ShellIntegration | undefined {
		const shellIntegration = (this.terminal as any).shellIntegration
		if (!shellIntegration) {
			return undefined
		}

		return {
			cwd: shellIntegration.cwd
				? {
						fsPath: shellIntegration.cwd.fsPath,
				  }
				: undefined,
			executeCommand: shellIntegration.executeCommand
				? (command: string): CommandExecution => {
						const execution = shellIntegration.executeCommand(command)
						return {
							read: async function* () {
								for await (const data of execution.read()) {
									yield data
								}
							},
						}
				  }
				: undefined,
		}
	}

	get exitStatus(): TerminalExitStatus | undefined {
		if (!this.terminal.exitStatus) {
			return undefined
		}
		return {
			code: this.terminal.exitStatus.code,
		}
	}

	sendText(text: string, addNewLine: boolean = true): void {
		this.terminal.sendText(text, addNewLine)
	}

	dispose(): void {
		this.terminal.dispose()
	}

	// Optional: Add helper methods for state checking
	get processId(): Thenable<number | undefined> {
		return this.terminal.processId
	}

	get state(): vscode.TerminalState {
		return this.terminal.state
	}

	show(preserveFocus?: boolean): void {
		this.terminal.show(preserveFocus)
	}

	hide(): void {
		this.terminal.hide()
	}
}

export class VSCodeTerminalWindowImpl implements ITerminalWindow {
	private window: typeof vscode.window

	constructor(window: typeof vscode.window) {
		this.window = window
	}

	createTerminal(options: { cwd?: string | IUri; name?: string }): ITerminal {
		// Convert options to VSCode terminal options
		const terminalOptions: vscode.TerminalOptions = {
			name: options.name,
			cwd:
				options.cwd instanceof Object
					? vscode.Uri.file(options.cwd.fsPath)
					: options.cwd
					? vscode.Uri.file(options.cwd)
					: undefined,
		}

		const terminal = this.window.createTerminal(terminalOptions)
		return new VSCodeTerminalImpl(terminal)
	}

	onDidCloseTerminal(listener: TerminalEventListener): IDisposable {
		const disposable = this.window.onDidCloseTerminal((terminal: vscode.Terminal) => {
			listener({
				terminal: new VSCodeTerminalImpl(terminal),
			})
		})

		return {
			dispose: () => {
				disposable.dispose()
			},
		}
	}

	// Helper methods for terminal management
	get activeTerminal(): ITerminal | undefined {
		const active = this.window.activeTerminal
		return active ? new VSCodeTerminalImpl(active) : undefined
	}

	get terminals(): ITerminal[] {
		return this.window.terminals.map((terminal) => new VSCodeTerminalImpl(terminal))
	}

	// Additional helper to handle shell integration events if available
	onDidStartTerminalShellExecution(
		listener: (e: { execution: { read: () => AsyncIterable<string> } }) => void
	): IDisposable | undefined {
		// Check if the shell execution API is available
		if ("onDidStartTerminalShellExecution" in this.window) {
			const disposable = (this.window as any).onDidStartTerminalShellExecution((e: any) => listener(e))
			return {
				dispose: () => {
					disposable.dispose()
				},
			}
		}
		return undefined
	}
}

export function getVscTerminalManger(): TerminalManager {
	return new TerminalManager(new VSCodeTerminalWindowImpl(vscode.window))
}
