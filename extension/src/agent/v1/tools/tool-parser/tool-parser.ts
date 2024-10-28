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
	private activeToolId: string | null = null
	private pendingTools: string[] = []
	private tagStack: string[] = []
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
			const tag = this.buffer
			const isClosingTag = tag.startsWith("</")
			const tagName = isClosingTag ? tag.slice(2, -1).split(" ")[0] : tag.slice(1, -1).split(" ")[0]

			if (!isClosingTag) {
				this.tagStack.push(tagName)
			} else {
				if (this.tagStack[this.tagStack.length - 1] === tagName) {
					this.tagStack.pop()
				}
			}

			if (this.toolSchemas.some((schema) => schema.name === tagName)) {
				this.checkForToolStart(tag)
			} else {
				this.nonToolBuffer += tag
			}

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
			if (this.activeToolId) {
				this.pendingTools.push(tag)
				return
			}

			this.isInTool = true
			const id = nanoid()
			this.activeToolId = id
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

		if (!isClosingTag) {
			this.tagStack.push(tagName)
		} else {
			if (this.tagStack[this.tagStack.length - 1] === tagName) {
				this.tagStack.pop()
			}
		}

		if (isClosingTag) {
			this.handleClosingTag(tagName)
		} else {
			this.handleOpeningTag(tagName)
		}
	}

	private handleOpeningTag(tagName: string): void {
		if (!this.currentContext) return

		if (this.currentContext.currentParam) {
			if (tagName === this.currentContext.currentParam) {
				this.currentContext.paramNestingLevel[tagName] =
					(this.currentContext.paramNestingLevel[tagName] || 0) + 1
			}
			this.currentContext.params[this.currentContext.currentParam] += this.buffer
		} else if (this.toolSchemas.some((schema) => schema.name === tagName)) {
			this.pendingTools.push(this.buffer)
			this.currentContext.nestingLevel++
		} else {
			this.currentContext.currentParam = tagName
			this.currentContext.paramNestingLevel[tagName] = 1
			this.currentContext.params[tagName] = ""
		}
	}

	private handleClosingTag(tagName: string): void {
		if (!this.currentContext) return

		if (tagName === this.currentContext.toolName && this.tagStack.length === 0) {
			this.currentContext.nestingLevel--
			if (this.currentContext.nestingLevel === 0) {
				this.finalizeTool(this.currentContext)
				this.isInTool = false
				this.activeToolId = null
				this.currentContext = null

				if (this.pendingTools.length > 0) {
					const nextTool = this.pendingTools.shift()
					if (nextTool) {
						this.nonToolBuffer += nextTool
					}
				}
			}
		} else if (tagName === this.currentContext.currentParam) {
			this.currentContext.paramNestingLevel[tagName]--

			if (this.currentContext.paramNestingLevel[tagName] === 0) {
				this.currentContext.currentParam = ""
				delete this.currentContext.paramNestingLevel[tagName]
			} else {
				this.currentContext.params[this.currentContext.currentParam] += this.buffer
			}
		} else if (this.currentContext.currentParam) {
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
		this.pendingTools = []
		this.tagStack = []
	}

	reset(): void {
		this.currentContext = null
		this.buffer = ""
		this.isInTag = false
		this.isInTool = false
		this.nonToolBuffer = ""
		this.activeToolId = null
		this.pendingTools = []
		this.tagStack = []
	}

	hasPendingTools(): boolean {
		return this.pendingTools.length > 0
	}

	getActiveToolId(): string | null {
		return this.activeToolId
	}
}

export default ToolParser

// const parser = new ToolParser(
// 	tools.map((t) => t.schema),
// 	{
// 		onToolUpdate: (id, toolName, params, ts) => {
// 			console.log("Update:", { id, toolName, params, ts })
// 		},
// 		onToolEnd: (id, toolName, params, ts) => {
// 			console.log("End:", { id, toolName, params, ts })
// 		},
// 		onToolError: (id, toolName, error, ts) => {
// 			console.error("Error:", { id, toolName, error, ts })
// 		},
// 		onToolClosingError: (error) => {
// 			console.error("Closing Error:", error)
// 		},
// 	}
// )

// const input = `<thinking>\nBefore proceeding with the task, I need to answer the critical questions:\n\n1. Did I read the file before writing to it? No\n2. Did I write to the file before? No\n3. Did the user provide the content of the file? Yes\n4. Do I have the last content of the file either from the user or from a previous read_file tool use or from write_to_file tool? Yes, user provided\n\nCurrent step: Write the content provided by the user to the file test.txt\nNext step: Confirm the file has been written successfully\n\nThe file path relative to the current path (/home/matan/code/test-3/kodu) is simply test.txt.\n\nThere are no current errors in the file that I should be aware of.\n\nThe project does not appear to be in a /frontend/[...path] structure, so I'll use the direct path.\n</thinking>\n\nNow, I'll proceed with writing the file as requested by the user.\n\n<write_to_file>\n<path>test.txt</path>\n<content><write_to_file><content>Hello world</content></write_to_file></content>\n</write_to_file>`

// parser.appendText(input)
// parser.endParsing()
