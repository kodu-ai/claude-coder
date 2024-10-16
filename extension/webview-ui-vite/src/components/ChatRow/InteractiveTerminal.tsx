import React, { useRef, useState, useCallback, useEffect } from "react"
import { useEvent, useMount, useUnmount } from "react-use"
import { vscode } from "@/utils/vscode"

import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import { Terminal as XTerm } from "@xterm/xterm"

import "xterm/css/xterm.css"
import { CommandExecutionResponse } from "../../../../src/shared/ExtensionMessage"

interface InteractiveTerminalProps {
	initialCommands?: string[]
}

const InteractiveTerminal = React.memo(() => {
	const terminalElementRef = useRef<HTMLDivElement>(null)
	const terminalRef = useRef<XTerm>()
	const [isExecuting, setIsExecuting] = useState(false)
	const [commandId, setCommandId] = useState<string | null>(null)

	const executeCommand = useCallback((command: string, isEnter = false) => {
		if (terminalRef.current) {
			setIsExecuting(true)

			console.log("Executing command:", command)
			vscode.postMessage({ type: "executeCommand", command, isEnter })
			console.log("Executing command:", command)
		}
	}, [])

	const handleCommandResponse = useCallback((event: MessageEvent) => {
		const response = event.data as CommandExecutionResponse
		if (response.type === "commandExecutionResponse" && terminalRef.current) {
			switch (response.status) {
				case "response":
					terminalRef.current.write(response.payload)
					setCommandId(response.commandId!)
					break
				case "error":
					terminalRef.current.writeln(`Error: ${response.payload}`)
					break
				case "exit":
					terminalRef.current.writeln(response.payload)
					setIsExecuting(false)
					terminalRef.current.write("$ ")
					setCommandId(null)
					break
			}
		}
	}, [])

	useEffect(() => {
		const element = terminalElementRef.current!

		const fitAddon = new FitAddon()
		const webLinksAddon = new WebLinksAddon()

		const terminal = new XTerm({
			cursorBlink: true,
			convertEol: true,
			disableStdin: false,
			fontSize: 14,
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

		terminal.writeln("Welcome to the Interactive Terminal!")
		terminal.write("$ ")

		let currentLine = ""

		terminal.onKey(({ key, domEvent }) => {
			const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

			executeCommand(key, domEvent.keyCode === 13)
			if (domEvent.keyCode === 13) {
				// Enter
				terminal.write("\r\n")
				if (currentLine.trim()) {
				}
				currentLine = ""
				if (!isExecuting) {
					terminal.write("$ ")
				}
			} else if (domEvent.keyCode === 8) {
				// Backspace
				if (currentLine.length > 0) {
					currentLine = currentLine.slice(0, -1)
					terminal.write("\b \b")
				}
			} else if (printable) {
				currentLine += key
				terminal.write(key)
			}
		})

		const resizeObserver = new ResizeObserver(() => {
			fitAddon.fit()
		})

		resizeObserver.observe(element)

		// Execute initial commands
		// initialCommands.forEach(executeCommand)

		return () => {
			resizeObserver.disconnect()
			terminal.dispose()
		}
	}, [executeCommand])

	useEvent("message", handleCommandResponse)

	return <div ref={terminalElementRef} style={{ height: "300px" }} />
})

export default InteractiveTerminal
