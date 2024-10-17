import React, { useRef, useState, useCallback, useEffect } from "react"
import { useEvent } from "react-use"
import { vscode } from "@/utils/vscode"

import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import { Terminal as XTerm } from "@xterm/xterm"

import "xterm/css/xterm.css"
import { CommandExecutionResponse } from "../../../../src/shared/ExtensionMessage"

interface HistoryEntry {
	command: string
	output: string
}

const InteractiveTerminal = ({ initialCommand }: { initialCommand?: string }) => {
	const terminalElementRef = useRef<HTMLDivElement>(null)
	const terminalRef = useRef<XTerm>()
	const [isExecuting, setIsExecuting] = useState(false)
	const commandIdRef = useRef<string | undefined>(undefined)
	const commandInputRef = useRef<string>("")
	const terminalHistoryRef = useRef<HistoryEntry[]>([])
	const currentHistoryIndexRef = useRef<number>(-1)
	const preservedInputRef = useRef<string>("")
	const isLongRunningCommandRef = useRef<boolean>(false)

	const addToHistory = useCallback((entry: HistoryEntry) => {
		terminalHistoryRef.current.push(entry)
		currentHistoryIndexRef.current = terminalHistoryRef.current.length
	}, [])

	const executeCommand = useCallback(
		(command: string, isEnter = false) => {
			if (terminalRef.current) {
				setIsExecuting(true)
				vscode.postMessage({ type: "executeCommand", commandId: commandIdRef.current, command, isEnter })

				if (!commandIdRef.current) {
					addToHistory({ command, output: "" })
					// Determine if it's likely a long-running command
					isLongRunningCommandRef.current =
						command.startsWith("npx") || command.includes("install") || command.includes("build")

					if (isLongRunningCommandRef.current) {
						terminalRef.current.clear()
						terminalRef.current.writeln(`Executing: ${command}`)
					}
				}
			}
		},
		[addToHistory]
	)

	const updateCommandId = useCallback((newCommandId: string | null) => {
		commandIdRef.current = newCommandId ?? undefined
	}, [])

	const handleCommandResponse = useCallback(
		(event: MessageEvent) => {
			const response = event.data as CommandExecutionResponse
			if (response.type === "commandExecutionResponse" && terminalRef.current) {
				switch (response.status) {
					case "response":
						if (isLongRunningCommandRef.current) {
							terminalRef.current.clear()
						}
						terminalRef.current.write(response.payload)
						updateCommandId(response.commandId!)
						break
					case "error":
						if (isLongRunningCommandRef.current) {
							terminalRef.current.clear()
						}
						terminalRef.current.writeln(`Error: ${response.payload}`)
						updateCommandId(null)
						setIsExecuting(false)
						terminalRef.current.write("$ ")
						break
					case "exit":
						if (isLongRunningCommandRef.current) {
							terminalRef.current.clear()
							terminalRef.current.writeln(response.payload)
						}
						setIsExecuting(false)
						if (commandIdRef.current) {
							terminalRef.current.write("$ ")
						}
						updateCommandId(null)
						isLongRunningCommandRef.current = false
						break
				}
			}
		},
		[updateCommandId]
	)

	useEffect(() => {
		const element = terminalElementRef.current!

		const fitAddon = new FitAddon()
		const webLinksAddon = new WebLinksAddon()

		const terminal = new XTerm({
			cursorBlink: true,
			convertEol: true,
			disableStdin: false,
			fontSize: 12,
			fontFamily: '"Cascadia Code", Menlo, courier-new, courier, monospace',
			theme: {
				background: "#1e1e1e",
				foreground: "#ffffff",
			},
		})

		terminalRef.current = terminal

		terminal.loadAddon(fitAddon)
		terminal.loadAddon(webLinksAddon)
		terminal.open(element)

		terminal.write("$ ")

		if (initialCommand) {
			terminal.write(initialCommand)
			terminal.write("\r\n")
		}

		let currentLine = ""

		terminal.onKey(({ key, domEvent }) => {
			const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

			if (commandIdRef.current) {
				// Long-running command mode: send every keystroke
				executeCommand(key, domEvent.keyCode === 13)
				if (printable || domEvent.keyCode === 13) {
					terminal.write(key)
				} else if (domEvent.keyCode === 8) {
					// Backspace
					terminal.write("\b \b")
				}
			} else {
				// Single execution command mode
				if (domEvent.keyCode === 13) {
					// Enter key
					terminal.write("\r\n")
					if (currentLine.trim()) {
						if (currentLine === "clear") {
							terminal.clear()
							terminal.write("$ ")
						} else {
							executeCommand(currentLine, true)
						}
						preservedInputRef.current = ""
					} else if (!isExecuting) {
						terminal.write("$ ")
					}
					currentLine = ""
				} else if (domEvent.keyCode === 8) {
					// Backspace
					if (currentLine.length > 0) {
						currentLine = currentLine.slice(0, -1)
						terminal.write("\b \b")
					}
				} else if (domEvent.keyCode === 38) {
					// Up arrow
					if (currentHistoryIndexRef.current === terminalHistoryRef.current.length) {
						preservedInputRef.current = currentLine
					}
					if (currentHistoryIndexRef.current > 0) {
						currentHistoryIndexRef.current--
						const prevCommand = terminalHistoryRef.current[currentHistoryIndexRef.current].command
						terminal.write("\x1b[2K\r$ " + prevCommand)
						currentLine = prevCommand
					}
				} else if (domEvent.keyCode === 40) {
					// Down arrow
					if (currentHistoryIndexRef.current < terminalHistoryRef.current.length - 1) {
						currentHistoryIndexRef.current++
						const nextCommand = terminalHistoryRef.current[currentHistoryIndexRef.current].command
						terminal.write("\x1b[2K\r$ " + nextCommand)
						currentLine = nextCommand
					} else if (currentHistoryIndexRef.current === terminalHistoryRef.current.length - 1) {
						currentHistoryIndexRef.current++
						terminal.write("\x1b[2K\r$ " + preservedInputRef.current)
						currentLine = preservedInputRef.current
					}
				} else if (printable) {
					currentLine += key
					terminal.write(key)
				}
			}

			commandInputRef.current = currentLine
		})

		const resizeObserver = new ResizeObserver(() => {
			fitAddon.fit()
		})

		resizeObserver.observe(element)

		return () => {
			resizeObserver.disconnect()
			terminal.dispose()
		}
	}, [executeCommand])

	useEvent("message", handleCommandResponse)

	return <div ref={terminalElementRef} style={{ height: "150px", borderRadius: "12px" }} />
}

export default InteractiveTerminal
