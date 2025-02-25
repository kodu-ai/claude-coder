import { BaseDialectParser, DialectParserConstructor, ToolSchema, ITextDialectParser } from "./base-dialect-parser"

/**
 * Context interface for JSON parsing state
 */
interface JsonContext {
	id: string
	ts: number
	toolName: string
	params: Record<string, any>
	jsonBuffer: string
	braceNestingLevel: number
	isComplete: boolean
}

/**
 * A JSON dialect parser that processes JSON syntax for tool commands
 */
export class JsonDialectParser extends BaseDialectParser implements ITextDialectParser {
	/**
	 * The type of dialect this parser handles
	 */
	readonly dialectType = "json" as const
	private currentContext: JsonContext | null = null
	private buffer: string = ""
	private nonToolBuffer: string = ""
	private isParsingTool: boolean = false
	private isInCodeBlock: boolean = false

	/**
	 * Time-based flush interval (in ms) for partial updates
	 */
	private readonly FLUSH_INTERVAL = 150

	/** Timestamp of the last partial update flush */
	private lastFlushTime: number = 0

	constructor(toolSchemas: ToolSchema[], options: DialectParserConstructor) {
		super(toolSchemas, options)
	}

	/**
	 * Returns whether the parser is currently inside a tool object
	 */
	get isInToolTag(): boolean {
		return this.isParsingTool
	}

	/**
	 * Process a text chunk and extract tool calls
	 * @param text - Text chunk to process
	 * @returns Non-tool content
	 */
	public appendText(text: string): string {
		for (const char of text) {
			this.processChar(char)
			this.checkTimeBasedFlush()
		}
		const output = this.nonToolBuffer
		this.nonToolBuffer = ""
		return output
	}

	/**
	 * Checks if enough time has passed since last flush to force an update
	 */
	private checkTimeBasedFlush() {
		if (!this.currentContext || this.currentContext.isComplete) {
			return // not inside a context or already completed
		}

		const now = Date.now()
		if (now - this.lastFlushTime >= this.FLUSH_INTERVAL) {
			// Only send update if we have a valid JSON object so far
			try {
				const partialJson = JSON.parse(this.currentContext.jsonBuffer)
				if (partialJson && typeof partialJson === "object" && partialJson.tool) {
					this.sendProgressUpdate(partialJson)
				}
			} catch (error) {
				// Invalid JSON, no partial update
			}
			this.lastFlushTime = now
		}
	}

	private processChar(char: string): void {
		// Handle code blocks (like markdown code blocks)
		if (char === "`") {
			this.isInCodeBlock = !this.isInCodeBlock
			this.nonToolBuffer += char
			return
		}

		if (this.isInCodeBlock) {
			this.nonToolBuffer += char
			return
		}

		if (this.isParsingTool) {
			this.processToolChar(char)
		} else {
			this.processNonToolChar(char)
		}
	}

	private processNonToolChar(char: string): void {
		// Look for the start of a potential JSON tool object
		if (char === "{") {
			this.buffer = char
			// Check if it's the start of a JSON object - we'll accumulate more to determine if it's a tool
			this.accumulator(char)
		} else if (this.buffer.length > 0) {
			// Continue accumulating to check if it's a tool
			this.buffer += char
			this.accumulator(char)
		} else {
			// Not in a potential tool, just add to non-tool buffer
			this.nonToolBuffer += char
		}
	}

	private processToolChar(char: string): void {
		if (!this.currentContext) {
			this.nonToolBuffer += char
			return
		}

		// Add the character to the JSON buffer
		this.currentContext.jsonBuffer += char

		// Track nesting of braces to know when the JSON object is complete
		if (char === "{") {
			this.currentContext.braceNestingLevel++
		} else if (char === "}") {
			this.currentContext.braceNestingLevel--

			// If we've closed all braces, we have a complete JSON object
			if (this.currentContext.braceNestingLevel === 0) {
				try {
					const toolJson = JSON.parse(this.currentContext.jsonBuffer)
					this.finalizeTool(this.currentContext, toolJson)
					this.isParsingTool = false
					this.currentContext = null
				} catch (error) {
					// Invalid JSON at end - this is unusual but handle gracefully
					if (this.currentContext) {
						this.onToolError?.(
							this.currentContext.id,
							this.currentContext.toolName,
							new Error(
								`Invalid JSON for tool: ${error instanceof Error ? error.message : String(error)}`
							),
							this.currentContext.ts
						)
					}
					this.isParsingTool = false
					this.currentContext = null
				}
			}
		}
	}

	/**
	 * Accumulate characters to identify potential tool objects
	 */
	private accumulator(char: string): void {
		const maxBufferLength = 100 // Limit buffer size for identifying tools

		// If buffer exceeds max length without finding a tool, reset
		if (this.buffer.length > maxBufferLength && !this.isParsingTool) {
			this.nonToolBuffer += this.buffer
			this.buffer = ""
			return
		}

		// Try to identify a tool as soon as we have "{"tool":"
		if (this.buffer.length >= 10 && !this.isParsingTool) {
			// Check for JSON pattern with a tool property
			const toolMatch = /"tool"\s*:\s*"([a-zA-Z0-9_]+)"/
			const match = this.buffer.match(toolMatch)

			if (match && match[1]) {
				const potentialToolName = match[1]

				// Verify this is a known tool
				if (this.toolSchemas.some((schema) => schema.name === potentialToolName)) {
					// Start tracking a tool
					this.isParsingTool = true

					const id = this.generateId()
					const ts = Date.now()
					this.currentContext = {
						id,
						ts,
						toolName: potentialToolName,
						params: {},
						jsonBuffer: this.buffer,
						braceNestingLevel: 1, // We've already seen one opening brace
						isComplete: false,
					}

					this.lastFlushTime = Date.now()
					this.onToolUpdate?.(id, potentialToolName, {}, ts)
					this.buffer = ""
					return
				}
			}

			// If we have a complete JSON object but it's not a tool, output and reset
			if (this.buffer.startsWith("{") && this.buffer.endsWith("}")) {
				try {
					JSON.parse(this.buffer)
					// Valid JSON but not a tool - output as is
					this.nonToolBuffer += this.buffer
					this.buffer = ""
				} catch (e) {
					// Not valid JSON yet, continue accumulating
				}
			}
		}
	}

	/**
	 * Send a progress update for the current partial tool content
	 */
	private sendProgressUpdate(partialJson: any): void {
		if (!this.currentContext) {
			return
		}

		// Extract params from the partial JSON
		const params = partialJson.params || {}

		this.onToolUpdate?.(this.currentContext.id, this.currentContext.toolName, params, this.currentContext.ts)

		// Refresh the flush timer
		this.lastFlushTime = Date.now()
	}

	/**
	 * Finalize a tool call with the complete JSON object
	 */
	private finalizeTool(context: JsonContext, toolJson: any): void {
		// Validate and finalize the tool parameters
		if (!toolJson.params || typeof toolJson.params !== "object") {
			this.onToolError?.(
				context.id,
				context.toolName,
				new Error("Missing or invalid params object in tool JSON"),
				context.ts
			)
			return
		}

		this.validateAndFinalizeTool(context.toolName, toolJson.params, context.id, context.ts)
	}

	/**
	 * Signal the end of parsing, handling any unclosed JSON objects
	 */
	public endParsing(): void {
		if (this.currentContext) {
			this.onToolClosingError?.(new Error("Unclosed JSON object at end of input"))
		}
	}

	/**
	 * Reset the parser state
	 */
	public reset(): void {
		this.currentContext = null
		this.buffer = ""
		this.nonToolBuffer = ""
		this.isParsingTool = false
		this.lastFlushTime = 0
		this.isInCodeBlock = false
	}
}
