import { EventEmitter } from "events"
import stripAnsi from "strip-ansi"
import { ITerminal } from "@/interfaces"
import { TerminalProcessEvents } from "@/types"

export class TerminalProcess extends EventEmitter<TerminalProcessEvents> {
	waitForShellIntegration: boolean = true
	private isListening: boolean = true
	private buffer: string = ""
	private fullOutput: string[] = []
	private lastRetrievedLineIndex: number = 0
	isHot: boolean = false

	async run(terminal: ITerminal, command: string) {
		this.isHot = true // Process is now running
		try {
			if (terminal.shellIntegration && terminal.shellIntegration.executeCommand) {
				const execution = terminal.shellIntegration.executeCommand(command)
				const stream = execution.read()
				let isFirstChunk = true
				let didEmitEmptyLine = false

				for await (let data of stream) {
					// Strip ANSI escape codes and VSCode shell integration sequences
					data = this.cleanDataChunk(data)

					// If after cleaning, data is empty, continue to the next chunk
					if (!data.trim()) {
						continue
					}

					// Process the data chunk
					this.processDataChunk(data, command, isFirstChunk)
					isFirstChunk = false

					// Emit an empty line to indicate the start of command output
					if (!didEmitEmptyLine && this.fullOutput.length === 0) {
						this.emit("line", "")
						didEmitEmptyLine = true
					}
				}

				this.emitRemainingBufferIfListening()
			} else {
				terminal.sendText(command, true)
				this.emit("no_shell_integration")
			}
		} catch (error) {
			this.emit("error", error instanceof Error ? error : new Error(String(error)))
			console.error(`Error in terminal process:`, error)
		} finally {
			this.isHot = false // Process has completed
			this.emitRemainingBufferIfListening()
			this.isListening = false
			this.emit("completed")
			this.emit("continue")
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

	private emitIfEol(chunk: string) {
		this.buffer += chunk
		let lineEndIndex: number
		while ((lineEndIndex = this.buffer.indexOf("\n")) !== -1) {
			let line = this.buffer.slice(0, lineEndIndex).trimEnd() // Removes trailing \r
			this.emit("line", line)
			this.fullOutput.push(line)
			this.buffer = this.buffer.slice(lineEndIndex + 1)
		}
	}

	private emitRemainingBufferIfListening() {
		if (this.buffer && this.isListening) {
			const remainingBuffer = this.buffer
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
