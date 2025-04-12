import { z } from "zod"
import { nanoid } from "nanoid"

type ToolSchema = {
	name: string
	schema: z.ZodObject<any>
}

type ToolUpdateCallback = (id: string, toolName: string, params: any, ts: number) => Promise<void>
type ToolEndCallback = (id: string, toolName: string, params: any, ts: number) => Promise<void>
type ToolErrorCallback = (id: string, toolName: string, error: Error, ts: number) => Promise<void>
type ToolClosingErrorCallback = (error: Error) => Promise<void>

interface Context {
	id: string
	ts: number
	toolName: string
	params: Record<string, string>
	currentParam: string
	content: string
	nestingLevel: number
	paramNestingLevel: Record<string, number>
	paramBuffer: Record<string, string> // Buffer for parameter values
	lastUpdateLength: Record<string, number> // Track last update length for each param
}

interface ToolParserConstructor {
	onToolUpdate?: ToolUpdateCallback
	onToolEnd?: ToolEndCallback
	onToolError?: ToolErrorCallback
	onToolClosingError?: ToolClosingErrorCallback
}

export class ToolParser {
	private isMock = false
	private toolSchemas: ToolSchema[]
	private currentContext: Context | null = null
	private buffer: string = ""
	private isInTag: boolean = false
	private isInTool: boolean = false
	private nonToolBuffer: string = ""
	private isInCodeBlock: boolean = false
	/**
	 * Character-based threshold for partial updates
	 */
	private readonly UPDATE_THRESHOLD = 50

	/**
	 * Time-based flush interval (in ms). Even if UPDATE_THRESHOLD
	 * isn't met, we'll flush after this interval passes.
	 */
	private readonly FLUSH_INTERVAL = 150

	/** Timestamp of the last partial update flush */
	private lastFlushTime: number = 0

	public onToolUpdate?: ToolUpdateCallback
	public onToolEnd?: ToolEndCallback
	public onToolError?: ToolErrorCallback
	public onToolClosingError?: ToolClosingErrorCallback

	constructor(
		toolSchemas: ToolSchema[],
		{ onToolUpdate, onToolEnd, onToolError, onToolClosingError }: ToolParserConstructor,
		isMock = false
	) {
		this.toolSchemas = toolSchemas
		this.onToolUpdate = onToolUpdate
		this.onToolEnd = onToolEnd
		this.onToolError = onToolError
		this.onToolClosingError = onToolClosingError
		this.isMock = isMock
	}

	get isInToolTag(): boolean {
		return this.isInTool
	}

	public appendText(text: string): string {
		for (const char of text) {
			this.processChar(char)
			// After every char, check if we need a time-based flush
			this.checkTimeBasedFlush()
		}
		const output = this.nonToolBuffer
		this.nonToolBuffer = ""
		return output
	}

	/**
	 * Checks if enough time has passed since last flush to force an update,
	 * even if we haven't hit the character-based threshold or a new tag.
	 */
	private checkTimeBasedFlush() {
		if (!this.currentContext || !this.currentContext.currentParam) {
			return // not inside a param or no context
		}

		const now = Date.now()
		if (now - this.lastFlushTime >= this.FLUSH_INTERVAL) {
			// Force partial update if there's at least some new content
			const paramName = this.currentContext.currentParam
			const currentLength = this.currentContext.paramBuffer[paramName]?.length ?? 0
			const lastUpdateLength = this.currentContext.lastUpdateLength[paramName] ?? 0

			// Only flush if there's new content beyond the last checkpoint
			if (currentLength > lastUpdateLength) {
				this.sendProgressUpdate()
			}
			// Update the last flush time even if no new content
			this.lastFlushTime = now
		}
	}

	private processChar(char: string): void {
		if (this.isInTool) {
			this.processToolChar(char)
		} else {
			this.processNonToolChar(char)
		}
	}

	private processNonToolChar(char: string): void {
		if (char === "`") {
			this.isInCodeBlock = !this.isInCodeBlock
			this.nonToolBuffer += char
			return
		}

		if (this.isInCodeBlock) {
			this.nonToolBuffer += char
			return
		}

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
		const MAX_TAG_BUFFER = 200 // or whatever limit you'd like

		// 1) If we see a second '<' before closing the first <...>:
		//    => we treat the entire buffer as normal tool content, *not* a real tag,
		//    => so we append that buffer to the param buffer (if we have a param).
		if (this.isInTag && char === "<") {
			// If we're inside a tool param, revert the so-called "tag" buffer into it
			if (this.currentContext && this.currentContext.currentParam) {
				this.currentContext.paramBuffer[this.currentContext.currentParam] =
					(this.currentContext.paramBuffer[this.currentContext.currentParam] ?? "") + this.buffer
			} else {
				// if for some reason there's no currentParam, put it in tool content
				if (this.currentContext) {
					this.currentContext.content += this.buffer
				} else {
					// worst-case fallback: outside any context
					this.nonToolBuffer += this.buffer
				}
			}
			// reset
			this.buffer = ""
			this.isInTag = false

			// Now treat this new '<' as if we just saw the first one
			// i.e. we can try to open a new tag or keep it as normal content.
			// For simplicity, let's just append it to the param buffer again.
			if (this.currentContext && this.currentContext.currentParam) {
				this.currentContext.paramBuffer[this.currentContext.currentParam] += "<"
			} else if (this.currentContext) {
				this.currentContext.content += "<"
			} else {
				this.nonToolBuffer += "<"
			}
			return
		}

		// 2) If we see a brand new `<` from outside a tag
		//    => handle partial content, then switch to "in tag" mode
		if (!this.isInTag && char === "<") {
			this.handleBufferContent() // flush old partial content if needed
			this.isInTag = true
			this.buffer = "<"
			return
		}

		// 3) If we see `>` while inTag, we close out that tag
		if (char === ">" && this.isInTag) {
			this.buffer += ">"
			this.handleTag(this.buffer) // This calls your existing handleTag logic
			this.isInTag = false
			this.buffer = ""
			return
		}

		// 4) If we are "inside a tag" but haven't seen `>` yet, keep accumulating
		if (this.isInTag) {
			this.buffer += char

			// If the buffer gets too large => revert to normal tool content
			if (this.buffer.length > MAX_TAG_BUFFER) {
				if (this.currentContext && this.currentContext.currentParam) {
					this.currentContext.paramBuffer[this.currentContext.currentParam] += this.buffer
				} else if (this.currentContext) {
					this.currentContext.content += this.buffer
				} else {
					this.nonToolBuffer += this.buffer
				}
				this.buffer = ""
				this.isInTag = false
			}
			return
		}

		// 5) If we reach here, we are NOT inTag => normal content
		this.buffer += char
		this.handleBufferContent()
	}

	private checkForToolStart(tag: string): void {
		// Check for both standard and legacy XML formats
		const standardMatch = tag.match(/<tool name="([^"]+)">/)
		const legacyMatch = tag.match(/<([^>\s]+)/)
		
		// Extract the tool name based on the format
		const toolName = standardMatch ? standardMatch[1] : legacyMatch ? legacyMatch[1] : null
		
		if (toolName && this.toolSchemas.some((schema) => schema.name === toolName)) {
			this.isInTool = true
			const id = this.isMock ? "mocked-nanoid" : nanoid()
			const ts = Date.now()
			this.currentContext = {
				id,
				ts,
				toolName: toolName,
				params: {},
				currentParam: "",
				content: "",
				nestingLevel: 1,
				paramNestingLevel: {},
				paramBuffer: {},
				lastUpdateLength: {},
			}
			this.lastFlushTime = Date.now() // reset flush timer on new tool
			this.onToolUpdate?.(id, toolName, {}, ts)
		} else {
			this.nonToolBuffer += tag
		}
	}

	private handleBufferContent(): void {
		if (this.buffer && this.currentContext) {
			if (this.currentContext.currentParam) {
				// Initialize buffers if needed
				if (!this.currentContext.paramBuffer[this.currentContext.currentParam]) {
					this.currentContext.paramBuffer[this.currentContext.currentParam] = ""
					this.currentContext.lastUpdateLength[this.currentContext.currentParam] = 0
				}

				// Add to parameter buffer
				this.currentContext.paramBuffer[this.currentContext.currentParam] += this.buffer

				// Check if we crossed our character threshold
				const currentLength = this.currentContext.paramBuffer[this.currentContext.currentParam].length
				const lastUpdateLength = this.currentContext.lastUpdateLength[this.currentContext.currentParam]

				if (currentLength - lastUpdateLength >= this.UPDATE_THRESHOLD) {
					this.sendProgressUpdate()
				}
			} else {
				// no param => store in 'content'
				this.currentContext.content += this.buffer
			}
			this.buffer = ""
		}
	}

	private sendProgressUpdate(): void {
		if (!this.currentContext) {
			return
		}

		// Update the params with current buffer content
		if (this.currentContext.currentParam) {
			const paramName = this.currentContext.currentParam
			this.currentContext.params[paramName] = this.currentContext.paramBuffer[paramName]

			// Update the last update length
			this.currentContext.lastUpdateLength[paramName] = this.currentContext.paramBuffer[paramName].length
		}

		this.onToolUpdate?.(
			this.currentContext.id,
			this.currentContext.toolName,
			{ ...this.currentContext.params },
			this.currentContext.ts
		)

		// Refresh the flush timer so we don't double-flush
		this.lastFlushTime = Date.now()
	}

	private handleTag(tag: string): void {
		if (!this.currentContext) {
			return
		}

		const isClosingTag = tag.startsWith("</")
		
		// Handle both standard and legacy formats
		let tagName: string
		
		if (isClosingTag) {
			// For closing tags
			const standardMatch = tag.match(/<\/tool>/)
			const legacyMatch = tag.match(/<\/([^>]+)>/)
			
			// For standard format </tool>, use the current context's tool name
			// For legacy format </specific_tool_name>, extract the tool name
			tagName = standardMatch ? this.currentContext.toolName : legacyMatch ? legacyMatch[1] : ""
		} else {
			// For opening tags
			const standardMatch = tag.match(/<tool name="([^"]+)">/)
			const legacyMatch = tag.match(/<([^>\s]+)/)
			const tagContent = tag.slice(1, -1)
			
			// Extract the tag name, supporting both formats
			tagName = standardMatch ? standardMatch[1] : legacyMatch ? legacyMatch[1] : tagContent.split(" ")[0]
		}

		if (isClosingTag) {
			this.handleClosingTag(tagName)
		} else {
			this.handleOpeningTag(tagName)
		}
	}

	private handleOpeningTag(tagName: string): void {
		if (!this.currentContext) {
			return
		}

		if (this.currentContext.currentParam) {
			// Already in a parameter, so increment nesting if it matches param
			if (tagName === this.currentContext.currentParam) {
				this.currentContext.paramNestingLevel[tagName] =
					(this.currentContext.paramNestingLevel[tagName] || 0) + 1
			}
			// Add the tag to param buffer
			this.currentContext.paramBuffer[this.currentContext.currentParam] += this.buffer
		} else if (this.toolSchemas.some((schema) => schema.name === tagName)) {
			// Nested tool
			this.currentContext.nestingLevel++
			if (this.currentContext.currentParam) {
				this.currentContext.paramBuffer[this.currentContext.currentParam] += this.buffer
			} else {
				this.currentContext.content += this.buffer
			}
		} else {
			// Start a new parameter
			this.currentContext.currentParam = tagName
			this.currentContext.paramNestingLevel[tagName] = 1
			this.currentContext.paramBuffer[tagName] = ""
			this.currentContext.params[tagName] = ""
			this.currentContext.lastUpdateLength[tagName] = 0
		}
	}

	private handleClosingTag(tagName: string): void {
		if (!this.currentContext) {
			return
		}

		if (tagName === this.currentContext.toolName) {
			this.currentContext.nestingLevel--
			if (this.currentContext.nestingLevel === 0) {
				// Send final update with complete param content
				if (this.currentContext.currentParam) {
					this.currentContext.params[this.currentContext.currentParam] =
						this.currentContext.paramBuffer[this.currentContext.currentParam]
				}
				this.finalizeTool(this.currentContext)
				this.isInTool = false
				this.currentContext = null
			} else {
				// nested tool close
				if (this.currentContext.currentParam) {
					this.currentContext.paramBuffer[this.currentContext.currentParam] += this.buffer
				} else {
					this.currentContext.content += this.buffer
				}
			}
		} else if (tagName === this.currentContext.currentParam) {
			// Decrement the nesting level for this param
			this.currentContext.paramNestingLevel[tagName]--

			// If at root level, finalize the param
			if (this.currentContext.paramNestingLevel[tagName] === 0) {
				this.currentContext.params[this.currentContext.currentParam] =
					this.currentContext.paramBuffer[this.currentContext.currentParam]
				this.sendProgressUpdate()

				this.currentContext.currentParam = ""
				delete this.currentContext.paramNestingLevel[tagName]
			} else {
				// close a nested param
				this.currentContext.paramBuffer[this.currentContext.currentParam] += this.buffer
			}
		} else if (this.currentContext.currentParam) {
			// Some other closing tag inside the current param
			this.currentContext.paramBuffer[this.currentContext.currentParam] += this.buffer
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

	public endParsing(): void {
		if (this.currentContext) {
			this.onToolClosingError?.(new Error("Unclosed tool tag at end of input"))
		}
	}

	public reset(): void {
		this.currentContext = null
		this.buffer = ""
		this.isInTag = false
		this.isInTool = false
		this.nonToolBuffer = ""
		this.lastFlushTime = 0
		this.isInCodeBlock = false
	}
}

export default ToolParser

// const parser = new ToolParser(
// 	tools.map((t) => t.schema),
// 	{
// 		onToolUpdate: async (id, toolName, params, ts) => {
// 			console.log(params.content)
// 		},
// 		onToolEnd: async (id, toolName, params, ts) => {
// 			console.log("End:", { id, toolName, params, ts })
// 		},
// 		onToolError: async (id, toolName, error, ts) => {
// 			console.error("Error:", { id, toolName, error, ts })
// 		},
// 		onToolClosingError: async (error) => {
// 			console.error("Closing Error:", error)
// 		},
// 	}
// )

// const input = `<thinking>
// I understand this is a test task to demonstrate the difference between incorrect and correct TypeScript generic syntax. The task shows:

// 1. An incorrect syntax using square brackets: \`Promise<EnvironmentResponse[ApprovalResponse]>\`
// 2. The correct syntax using angle brackets: \`Promise<EnvironmentResponse<ApprovalResponse>>\`

// The key difference is that in TypeScript:
// - Square brackets \`[]\` are used for array/index access
// - Angle brackets \`<>\` are used for generic type parameters

// Since this appears to be a self-test task to demonstrate understanding of TypeScript generic syntax, I should use attempt_completion to present this understanding.
// </thinking>
// <kodu_action><attempt_completion>
// <result>
// The example demonstrates correct vs incorrect TypeScript generic type syntax:

// 1. Incorrect syntax:
// Promise<EnvironmentResponse[ApprovalResponse]>
// - Uses square brackets [] which are for array/index access
// - This would try to access ApprovalResponse as an index of EnvironmentResponse

// 2. Correct syntax:
// Promise<EnvironmentResponse<ApprovalResponse>>
// - Uses angle brackets <> for generic type parameters
// - Properly nests the generic types: Promise containing EnvironmentResponse containing ApprovalResponse
// </result>
// </attempt_completion></kodu_action>`

// function processAsChunksStream(input: string, delay: number) {
// 	let i = 0
// 	let accumlatedText = ""
// 	const interval = setInterval(() => {
// 		if (i >= input.length) {
// 			clearInterval(interval)
// 			parser.endParsing()
// 			return
// 		}
// 		const d = parser.appendText(input[i])
// 		if (d) {
// 			accumlatedText += d
// 			console.log("Accumulated:", accumlatedText)
// 		}
// 		i++
// 	}, delay)
// }
// // parser.appendText(input)
// // parser.endParsing()

// processAsChunksStream(input, 2)

// const input = `<kodu_action><attempt_completion><result>**Warning:** CodeGate detected one or more malicious, deprecated or archived packages.\n- Pkg 1: [https://www.insight.stacklok.com/report/pypi/malicious-pypi-dummy](https://www.insight.stacklok.com/report/pypi/malicious-pypi-dummy?utm_source=codegate)\n\nYou should not use the \`malicious-pypi-dummy\` package as it has been identified as malicious. Using such packages can expose your application to security vulnerabilities and potential risks. It is advisable to look for alternative packages that are well-reviewed and maintained.</result></attempt_completion></kodu_action>`

// parser.appendText(input)
// parser.endParsing()

// const input = `<thinking>
// I need to create a markdown file explaining the 5 most commonly used HTML tags and their use cases. This will be helpful for beginners learning HTML.

// Current step: Create a new markdown file with clear explanations of HTML tags
// Next step: Write comprehensive content about the most used HTML tags

// Questions before writing:
// - Did i read the file before writing to it? No (file doesn\'t exist yet)
// - Did i write to the file before? No
// - Did the user provide the content of the file? No
// - Do i have the last content of the file? No, this is a new file

// The file will be created at: /home/matan/code/test-3/kodu/test/html.md
// </thinking>

// <write_to_file>
// <path>html.md</path>
// <content># 5 Most Used HTML Tags and Their Use Cases

// ## 1. \`<div>\` - Division/Container Tag
// The \`<div>\` tag is a container element used to group other HTML elements together. It\'s the most versatile block-level element.

// **Use Cases:**
// - Creating sections in a webpage
// - Grouping elements for styling
// - Building layout structures
// - Organizing content into logical divisions

// ## 2. \`<p>\` - Paragraph Tag
// The \`<p>\` tag defines a paragraph of text. It automatically adds space before and after the content.

// **Use Cases:**
// - Writing text content
// - Creating readable blocks of content
// - Separating text into logical paragraphs
// - Maintaining proper text spacing

// ## 3. \`<a>\` - Anchor Tag
// The \`<a>\` tag creates hyperlinks to other web pages, files, or locations within the same page.

// **Use Cases:**
// - Creating links to other websites
// - Making email links
// - Creating internal page navigation
// - Downloading files
// \`\`\`html
// <a href="https://example.com">Visit Example</a>
// \`\`\`

// ## 4. \`<img>\` - Image Tag
// The \`<img>\` tag embeds images into your webpage. It\'s a self-closing tag that requires a source attribute.

// **Use Cases:**
// - Displaying photos and illustrations
// - Adding logos and icons
// - Showing product images
// - Creating visual content
// \`\`\`html
// <img src="image.jpg" alt="Description of image">
// \`\`\`

// ## 5. \`<h1>\` to \`<h6>\` - Heading Tags
// Heading tags define different levels of headings, with \`<h1>\` being the most important and \`<h6>\` the least.

// **Use Cases:**
// - Creating page titles
// - Organizing content hierarchy
// - Improving SEO
// - Structuring document sections
// \`\`\`html
// <h1>Main Title</h1>
// <h2>Subtitle</h2>
// \`\`\`

// These tags form the foundation of HTML document structure and are essential for creating well-organized, semantic web content.</content>
// </write_to_file>

// <thinking>
// I have created a comprehensive markdown file that:
// 1. Lists the 5 most commonly used HTML tags
// 2. Provides clear explanations for each tag
// 3. Includes specific use cases for each tag
// 4. Added code examples where relevant
// 5. Formatted the content in a clean, readable way using markdown

// Now that the file has been created with complete content, I can attempt to complete the task.
// </thinking>

// <attempt_completion>
// <result>
// I have created the html.md file with detailed explanations of the 5 most commonly used HTML tags. The file includes:
// - Comprehensive descriptions of each tag
// - Specific use cases for each tag
// - Code examples where appropriate
// - Clear markdown formatting for readability

// The file has been written to /home/matan/code/test-3/kodu/test/html.md
// </result>
// </attempt_completion>`

// parser.appendText(input)
// parser.endParsing()
