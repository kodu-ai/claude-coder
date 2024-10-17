import { z } from "zod"
import { nanoid } from "nanoid"

type ToolSchema = {
	name: string
	schema: z.ZodObject<any>
}

type ToolUpdateCallback = (id: string, toolName: string, params: any, ts: number) => void
type ToolEndCallback = (id: string, toolName: string, params: any, ts: number) => void
type ToolErrorCallback = (id: string, toolName: string, error: Error) => void
type ToolClosingErrorCallback = (error: Error) => void

interface Context {
	id: string
	ts: number
	toolName: string
	params: Record<string, string>
	currentParam: string
	content: string
}

interface ToolParserConstructor {
	onToolUpdate?: ToolUpdateCallback
	onToolEnd?: ToolEndCallback
	onToolError?: ToolErrorCallback
	onToolClosingError?: ToolClosingErrorCallback
}

export class ToolParser {
	private toolSchemas: ToolSchema[]
	private currentContext: Context | null = null
	private buffer: string = ""
	private isInTag: boolean = false
	private isInTool: boolean = false
	private nonToolBuffer: string = ""
	public onToolUpdate?: ToolUpdateCallback
	public onToolEnd?: ToolEndCallback
	public onToolError?: ToolErrorCallback
	public onToolClosingError?: ToolClosingErrorCallback

	constructor(
		toolSchemas: ToolSchema[],
		{ onToolUpdate, onToolEnd, onToolError, onToolClosingError }: ToolParserConstructor
	) {
		this.toolSchemas = toolSchemas
		this.onToolUpdate = onToolUpdate
		this.onToolEnd = onToolEnd
		this.onToolError = onToolError
		this.onToolClosingError = onToolClosingError
	}

	appendText(text: string): string {
		for (const char of text) {
			this.processChar(char)
		}
		const output = this.nonToolBuffer
		this.nonToolBuffer = ""
		return output
	}

	private processChar(char: string): void {
		if (this.isInTool) {
			this.processToolChar(char)
		} else {
			this.processNonToolChar(char)
		}
	}

	private processNonToolChar(char: string): void {
		if (char === "<") {
			this.isInTag = true
			this.buffer = char
		} else if (char === ">" && this.isInTag) {
			this.buffer += char
			this.checkForToolStart(this.buffer)
			this.isInTag = false
			this.buffer = ""
		} else {
			if (this.isInTag) {
				this.buffer += char
			} else {
				this.nonToolBuffer += char
			}
		}
	}

	private processToolChar(char: string): void {
		if (char === "<") {
			this.handleBufferContent()
			this.isInTag = true
			this.buffer = char
		} else if (char === ">" && this.isInTag) {
			this.buffer += char
			this.handleTag(this.buffer)
			this.isInTag = false
			this.buffer = ""
		} else {
			this.buffer += char
			if (!this.isInTag) {
				this.handleBufferContent()
			}
		}
	}

	private checkForToolStart(tag: string): void {
		const tagName = tag.slice(1, -1).split(" ")[0]
		if (this.toolSchemas.some((schema) => schema.name === tagName)) {
			this.isInTool = true
			const id = nanoid()
			const ts = Date.now()
			this.currentContext = {
				id,
				ts,
				toolName: tagName,
				params: {},
				currentParam: "",
				content: "",
			}
			this.onToolUpdate?.(id, tagName, {}, ts)
		} else {
			this.nonToolBuffer += tag
		}
	}

	private handleBufferContent(): void {
		if (this.buffer && this.currentContext) {
			if (this.currentContext.currentParam) {
				this.currentContext.params[this.currentContext.currentParam] += this.buffer
				this.onToolUpdate?.(
					this.currentContext.id,
					this.currentContext.toolName,
					{ ...this.currentContext.params },
					this.currentContext.ts
				)
			} else {
				this.currentContext.content += this.buffer
			}
			this.buffer = ""
		}
	}

	private handleTag(tag: string): void {
		if (tag.startsWith("</")) {
			this.handleClosingTag(tag)
		} else {
			this.handleOpeningTag(tag)
		}
	}

	private handleOpeningTag(tag: string): void {
		if (this.currentContext) {
			const tagName = tag.slice(1, -1).split(" ")[0]
			if (this.currentContext.currentParam) {
				// We're inside a parameter, treat this as content
				this.currentContext.params[this.currentContext.currentParam] += tag
			} else {
				this.currentContext.currentParam = tagName
				this.currentContext.params[tagName] = ""
			}
		}
	}

	private handleClosingTag(tag: string): void {
		if (this.currentContext) {
			const tagName = tag.slice(2, -1)
			if (tagName === this.currentContext.toolName) {
				this.finalizeTool(this.currentContext)
				this.isInTool = false
				this.currentContext = null
			} else if (tagName === this.currentContext.currentParam) {
				// End of parameter
				this.currentContext.currentParam = ""
			} else if (this.currentContext.currentParam) {
				// Closing tag inside parameter content
				this.currentContext.params[this.currentContext.currentParam] += tag
			}
		}
	}

	private finalizeTool(context: Context): void {
		const toolSchema = this.toolSchemas.find((schema) => schema.name === context.toolName)
		if (!toolSchema) {
			this.onToolError?.(context.id, context.toolName, new Error(`Unknown tool: ${context.toolName}`))
			return
		}

		try {
			const validatedParams = toolSchema.schema.parse(context.params)
			this.onToolEnd?.(context.id, context.toolName, validatedParams, context.ts)
		} catch (error) {
			if (error instanceof z.ZodError) {
				this.onToolError?.(context.id, context.toolName, new Error(`Validation error: ${error.message}`))
			} else {
				this.onToolError?.(context.id, context.toolName, error as Error)
			}
		}
	}

	endParsing(): void {
		if (this.currentContext) {
			this.onToolClosingError?.(new Error("Unclosed tool tag at end of input"))
		}
	}
}

export default ToolParser
