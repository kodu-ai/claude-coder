import { z } from "zod"
import { nanoid } from "nanoid"
import { tools } from "../schema"

type ToolSchema = {
	name: string
	schema: z.ZodObject<any>
}

type ToolUpdateCallback = (id: string, toolName: string, params: any, ts: number) => void
type ToolEndCallback = (id: string, toolName: string, params: any, ts: number) => void
type ToolErrorCallback = (id: string, toolName: string, error: Error, ts: number) => void
type ToolClosingErrorCallback = (error: Error) => void

interface Context {
	id: string
	ts: number
	toolName: string
	params: Record<string, string>
	currentParam: string
	content: string
	nestingLevel: number
	paramNestingLevel: Record<string, number>
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
			if (this.isInTag) {
				this.buffer += char
			} else {
				this.buffer += char
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
				nestingLevel: 1,
				paramNestingLevel: {},
			}
			this.onToolUpdate?.(id, tagName, {}, ts)
		} else {
			this.nonToolBuffer += tag
		}
	}

	private handleBufferContent(): void {
		if (this.buffer && this.currentContext) {
			if (this.currentContext.currentParam) {
				if (!this.currentContext.params[this.currentContext.currentParam]) {
					this.currentContext.params[this.currentContext.currentParam] = ""
				}
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
		if (!this.currentContext) return

		const isClosingTag = tag.startsWith("</")
		const tagContent = isClosingTag ? tag.slice(2, -1) : tag.slice(1, -1)
		const tagName = tagContent.split(" ")[0]

		if (isClosingTag) {
			this.handleClosingTag(tagName)
		} else {
			this.handleOpeningTag(tagName)
		}
	}

	private handleOpeningTag(tagName: string): void {
		if (!this.currentContext) return

		if (this.currentContext.currentParam) {
			// We're in a parameter, increment its nesting level if we see its tag
			if (tagName === this.currentContext.currentParam) {
				this.currentContext.paramNestingLevel[tagName] =
					(this.currentContext.paramNestingLevel[tagName] || 0) + 1
			}
			// Add the tag as content
			this.currentContext.params[this.currentContext.currentParam] += this.buffer
		} else if (this.toolSchemas.some((schema) => schema.name === tagName)) {
			// This is a nested tool tag
			this.currentContext.nestingLevel++
			if (this.currentContext.currentParam) {
				this.currentContext.params[this.currentContext.currentParam] += this.buffer
			} else {
				this.currentContext.content += this.buffer
			}
		} else {
			// This is a new parameter
			this.currentContext.currentParam = tagName
			this.currentContext.paramNestingLevel[tagName] = 1
			this.currentContext.params[tagName] = ""
		}
	}

	private handleClosingTag(tagName: string): void {
		if (!this.currentContext) return

		if (tagName === this.currentContext.toolName) {
			this.currentContext.nestingLevel--
			if (this.currentContext.nestingLevel === 0) {
				this.finalizeTool(this.currentContext)
				this.isInTool = false
				this.currentContext = null
			} else {
				// This is a nested closing tool tag
				if (this.currentContext.currentParam) {
					this.currentContext.params[this.currentContext.currentParam] += this.buffer
				} else {
					this.currentContext.content += this.buffer
				}
			}
		} else if (tagName === this.currentContext.currentParam) {
			// Decrement the nesting level for this parameter
			this.currentContext.paramNestingLevel[tagName]--

			// Only clear the current parameter if we're at the root level
			if (this.currentContext.paramNestingLevel[tagName] === 0) {
				this.currentContext.currentParam = ""
				delete this.currentContext.paramNestingLevel[tagName]
			} else {
				// This is a nested closing tag, add it as content
				this.currentContext.params[this.currentContext.currentParam] += this.buffer
			}
		} else if (this.currentContext.currentParam) {
			// This is some other closing tag inside a parameter
			this.currentContext.params[this.currentContext.currentParam] += this.buffer
		}
	}

	private finalizeTool(context: Context): void {
		const toolSchema = this.toolSchemas.find((schema) => schema.name === context.toolName)
		if (!toolSchema) {
			this.onToolError?.(context.id, context.toolName, new Error(`Unknown tool: ${context.toolName}`), context.ts)
			return
		}

		try {
			const validatedParams = toolSchema.schema.parse(context.params)
			this.onToolEnd?.(context.id, context.toolName, validatedParams, context.ts)
		} catch (error) {
			if (error instanceof z.ZodError) {
				this.onToolError?.(
					context.id,
					context.toolName,
					new Error(`Validation error: ${error.message}`),
					context.ts
				)
			} else {
				this.onToolError?.(context.id, context.toolName, error as Error, context.ts)
			}
		}
	}

	endParsing(): void {
		if (this.currentContext) {
			this.onToolClosingError?.(new Error("Unclosed tool tag at end of input"))
		}
	}

	reset(): void {
		this.currentContext = null
		this.buffer = ""
		this.isInTag = false
		this.isInTool = false
		this.nonToolBuffer = ""
	}
}

export default ToolParser
