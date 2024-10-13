// tool-executor.ts
import { z } from "zod"

type ToolSchema = z.ZodObject<any>

type ToolUpdateCallback = (toolName: string, params: Record<string, any>) => void
type ToolEndCallback = (toolName: string, params: Record<string, any>) => void
type ToolErrorCallback = (toolName: string, error: Error) => void
type ToolClosingErrorCallback = (error: Error) => void

enum ParsingState {
	TEXT,
	TAG_OPEN,
	TAG_NAME,
	ATTRIBUTES,
	TAG_CLOSE,
	CONTENT,
}

class ToolExecutor {
	private toolSchemas: ToolSchema[]
	private currentState: ParsingState = ParsingState.TEXT
	private buffer: string = ""
	private currentTag: string = ""
	private currentAttributes: Record<string, string> = {}
	private currentContent: string = ""
	private tagStack: string[] = []
	private currentTool: { name: string; params: Record<string, any> } | null = null
	private isKnownTool: boolean = false

	constructor(toolSchemas: ToolSchema[]) {
		this.toolSchemas = toolSchemas
	}

	appendText(text: string): void {
		for (const char of text) {
			this.processChar(char)
		}
	}

	endParsing(): void {
		if (this.tagStack.length > 0) {
			this.onToolClosingError(new Error("Unclosed tags at end of input"))
		}
	}

	onToolUpdate: ToolUpdateCallback = () => {}
	onToolEnd: ToolEndCallback = () => {}
	onToolError: ToolErrorCallback = () => {}
	onToolClosingError: ToolClosingErrorCallback = () => {}

	private processChar(char: string): void {
		switch (this.currentState) {
			case ParsingState.TEXT:
				if (char === "<") {
					this.currentState = ParsingState.TAG_OPEN
					this.buffer = ""
				}
				break

			case ParsingState.TAG_OPEN:
				if (char === "/") {
					this.currentState = ParsingState.TAG_CLOSE
					this.buffer = ""
				} else {
					this.currentState = ParsingState.TAG_NAME
					this.buffer = char
				}
				break

			case ParsingState.TAG_NAME:
				if (char.match(/\s/)) {
					this.currentTag = this.buffer
					this.buffer = ""
					this.currentState = ParsingState.ATTRIBUTES
				} else if (char === ">") {
					this.currentTag = this.buffer
					this.buffer = ""
					this.handleStartTag()
				} else {
					this.buffer += char
				}
				break

			case ParsingState.ATTRIBUTES:
				if (char === ">") {
					this.handleStartTag()
				} else {
					this.buffer += char
				}
				break

			case ParsingState.TAG_CLOSE:
				if (char === ">") {
					const closingTag = this.buffer
					this.buffer = ""
					this.handleEndTag(closingTag)
					this.currentState = ParsingState.TEXT
				} else {
					this.buffer += char
				}
				break

			case ParsingState.CONTENT:
				if (char === "<") {
					this.handleContent()
					this.currentState = ParsingState.TAG_OPEN
				} else {
					this.buffer += char
				}
				break
		}
	}

	private handleStartTag(): void {
		this.tagStack.push(this.currentTag)

		if (this.currentTag === "tool") {
			// Extract 'name' attribute from the buffer
			const nameMatch = this.buffer.match(/name="([^"]+)"/)
			if (nameMatch) {
				const toolName = nameMatch[1]
				// Check if tool is known
				const schema = this.toolSchemas.find((s) => s.shape.toolName.value === toolName)
				if (schema) {
					this.currentTool = { name: toolName, params: {} }
					this.isKnownTool = true
				} else {
					this.isKnownTool = false
					this.currentTool = null
				}
			} else {
				this.onToolError("", new Error("Tool name not specified"))
			}
		}

		this.buffer = ""
		this.currentState = ParsingState.CONTENT
	}

	private handleEndTag(tagName: string): void {
		const expectedTag = this.tagStack.pop()
		if (tagName !== expectedTag) {
			this.onToolClosingError(new Error(`Mismatched tag: expected </${expectedTag}> but found </${tagName}>`))
			return
		}

		if (tagName !== "tool" && this.isKnownTool && this.currentTool) {
			// It's a parameter closing tag
			this.currentTool.params[tagName] = this.currentContent.trim()
			this.onToolUpdate(this.currentTool.name, { ...this.currentTool.params })
			this.currentContent = ""
		}

		if (tagName === "tool") {
			if (this.isKnownTool && this.currentTool) {
				this.finalizeTool()
			}
			// Reset tool-related flags
			this.currentTool = null
			this.isKnownTool = false
		}

		this.currentState = ParsingState.CONTENT
	}

	private handleContent(): void {
		if (this.currentTag !== "tool") {
			this.currentContent = this.buffer
		}
		this.buffer = ""
	}

	private finalizeTool(): void {
		if (!this.currentTool) return

		const { name, params } = this.currentTool
		const schema = this.toolSchemas.find((s) => s.shape.toolName.value === name)

		if (!schema) {
			// This should not happen as we have already checked for known tools
			this.onToolError(name, new Error(`Unknown tool: ${name}`))
			return
		}

		try {
			const validatedParams = schema.parse({ toolName: name, ...params })
			this.onToolEnd(name, validatedParams)
		} catch (error) {
			if (error instanceof z.ZodError) {
				this.onToolError(name, new Error(`Validation error: ${error.message}`))
			} else {
				this.onToolError(name, error as Error)
			}
		}
	}
}

export default ToolExecutor
