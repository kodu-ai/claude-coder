import { z } from "zod"
import { nanoid } from "nanoid"
type ToolSchema = {
	name: string
	schema: z.ZodObject<any>
}

type ToolUpdateCallback = (id: string, toolName: string, params: any) => void
type ToolEndCallback = (id: string, toolName: string, params: any) => void
type ToolErrorCallback = (id: string, toolName: string, error: Error) => void
type ToolClosingErrorCallback = (error: Error) => void

interface Context {
	id: string
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
	private stack: Context[] = []
	private buffer: string = ""
	private isInTag: boolean = false
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

	appendText(text: string): void {
		for (const char of text) {
			this.processChar(char)
		}
	}

	private processChar(char: string): void {
		if (char === "<" && !this.isInTag) {
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

	private handleBufferContent(): void {
		if (this.buffer && this.stack.length > 0) {
			const currentContext = this.stack[this.stack.length - 1]
			if (currentContext.currentParam) {
				currentContext.params[currentContext.currentParam] += this.buffer
				this.onToolUpdate?.(currentContext.id, currentContext.toolName, { ...currentContext.params })
			} else {
				currentContext.content += this.buffer
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
		const tagName = tag.slice(1, -1).split(" ")[0]
		if (this.toolSchemas.some((schema) => schema.name === tagName)) {
			const id = nanoid()
			this.stack.push({
				id,
				toolName: tagName,
				params: {},
				currentParam: "",
				content: "",
			})
			this.onToolUpdate?.(id, tagName, {})
		} else if (this.stack.length > 0) {
			const currentContext = this.stack[this.stack.length - 1]
			currentContext.currentParam = tagName
			currentContext.params[tagName] = ""
		}
	}

	private handleClosingTag(tag: string): void {
		const tagName = tag.slice(2, -1)
		if (this.stack.length > 0) {
			const currentContext = this.stack[this.stack.length - 1]
			if (tagName === currentContext.toolName) {
				this.finalizeTool(currentContext)
				this.stack.pop()
			} else if (tagName === currentContext.currentParam) {
				currentContext.currentParam = ""
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
			this.onToolEnd?.(context.id, context.toolName, validatedParams)
		} catch (error) {
			if (error instanceof z.ZodError) {
				this.onToolError?.(context.id, context.toolName, new Error(`Validation error: ${error.message}`))
			} else {
				this.onToolError?.(context.id, context.toolName, error as Error)
			}
		}
	}

	endParsing(): void {
		if (this.stack.length > 0) {
			this.onToolClosingError?.(new Error("Unclosed tags at end of input"))
		}
	}
}

export default ToolParser
