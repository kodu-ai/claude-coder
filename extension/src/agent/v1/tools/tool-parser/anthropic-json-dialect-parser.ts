import {
	BaseDialectParser,
	DialectParserConstructor,
	ToolSchema,
	IEventStreamDialectParser,
} from "./base-dialect-parser"

/**
 * Context interface for Anthropic JSON event stream parsing state
 */
interface AnthropicJsonContext {
	id: string
	ts: number
	toolName: string
	params: Record<string, any>
	isComplete: boolean
	anthropicId?: string // Store Anthropic's tool use ID
}

/**
 * Interface for Anthropic message_start event
 */
interface AnthropicMessageStart {
	type: "message_start"
	message: {
		id: string
		type: "message"
		role: "assistant"
		model: string
		content: Array<any>
		stop_reason: string | null
	}
}

/**
 * Interface for Anthropic content_block_start event with tool_use type
 */
interface AnthropicContentBlockStartToolUse {
	type: "content_block_start"
	index: number
	content_block: {
		type: "tool_use"
		id: string
		name: string
		input: Record<string, any>
	}
}

/**
 * Interface for Anthropic content_block_start event with text type
 */
interface AnthropicContentBlockStartText {
	type: "content_block_start"
	index: number
	content_block: {
		type: "text"
		text?: string
	}
}

/**
 * Interface for Anthropic content_block_start event with thinking type
 */
interface AnthropicContentBlockStartThinking {
	type: "content_block_start"
	index: number
	content_block: {
		type: "thinking"
		thinking?: string
	}
}

/**
 * Interface for Anthropic content_block_delta event with text_delta
 */
interface AnthropicContentBlockDeltaText {
	type: "content_block_delta"
	index: number
	delta: {
		type: "text_delta"
		text: string
	}
}

/**
 * Interface for Anthropic content_block_delta event with thinking_delta
 */
interface AnthropicContentBlockDeltaThinking {
	type: "content_block_delta"
	index: number
	delta: {
		type: "thinking_delta"
		thinking: string
	}
}

/**
 * Interface for Anthropic content_block_delta event with input_json_delta
 */
interface AnthropicContentBlockDeltaJson {
	type: "content_block_delta"
	index: number
	delta: {
		type: "input_json_delta"
		partial_json: string
	}
}

/**
 * Interface for Anthropic content_block_stop event
 */
interface AnthropicContentBlockStop {
	type: "content_block_stop"
	index: number
}

/**
 * Interface for Anthropic message_delta event
 */
interface AnthropicMessageDelta {
	type: "message_delta"
	delta: {
		stop_reason: string | null
		stop_sequence: string | null
	}
	usage: {
		output_tokens: number
	}
}

/**
 * Interface for Anthropic message_stop event
 */
interface AnthropicMessageStop {
	type: "message_stop"
}

/**
 * Type for any Anthropic event
 */
type AnthropicEvent =
	| AnthropicMessageStart
	| AnthropicContentBlockStartToolUse
	| AnthropicContentBlockStartText
	| AnthropicContentBlockStartThinking
	| AnthropicContentBlockDeltaText
	| AnthropicContentBlockDeltaThinking
	| AnthropicContentBlockDeltaJson
	| AnthropicContentBlockStop
	| AnthropicMessageDelta
	| AnthropicMessageStop

/**
 * An Anthropic JSON dialect parser that processes Anthropic's event stream format
 * for tool commands and extended thinking
 */
export class AnthropicJsonDialectParser extends BaseDialectParser implements IEventStreamDialectParser {
	/**
	 * The type of dialect this parser handles
	 */
	readonly dialectType = "anthropic-json" as const

	private currentContext: AnthropicJsonContext | null = null
	private isInToolBlock: boolean = false
	private nonToolBuffer: string = ""
	private currentTextBuffer: string = ""
	private currentToolJsonBuffer: string = ""

	// Native thinking support
	private isInNativeThinking: boolean = false
	private currentThinkingBuffer: string = ""

	// Legacy thinking support (for backward compatibility)
	private isInLegacyThinking: boolean = false
	private legacyThinkingBuffer: string = ""

	/**
	 * Map to track active content blocks by index
	 */
	private activeBlocks: Map<
		number,
		{
			type: string
			anthropicId?: string
			name?: string
		}
	> = new Map()

	constructor(toolSchemas: ToolSchema[], options: DialectParserConstructor) {
		super(toolSchemas, options)
	}

	/**
	 * Returns whether the parser is currently inside a tool object
	 */
	get isInToolTag(): boolean {
		return this.isInToolBlock
	}

	/**
	 * Process a text chunk from the event stream
	 * @param text - Text chunk to process (an SSE event)
	 * @returns Non-tool content
	 */
	public appendText(text: string): string {
		// Process each event line
		const lines = text.split("\n").filter((line) => line.trim() !== "")

		for (const line of lines) {
			// Events start with "event: " followed by the event name
			// Data starts with "data: " followed by JSON
			if (line.startsWith("event: ")) {
				// Just note the event type, but process the data
				continue
			} else if (line.startsWith("data: ")) {
				const jsonStr = line.substring(6) // Remove "data: " prefix
				try {
					const event = JSON.parse(jsonStr) as AnthropicEvent
					console.log("Parsed Anthropic event:", event)
					this.processEvent(event)
				} catch (error) {
					console.error("Error parsing Anthropic event JSON:", error)
				}
			}
		}

		const output = this.nonToolBuffer
		this.nonToolBuffer = ""
		return output
	}

	/**
	 * Process a parsed event object directly
	 * @param event - The parsed event object
	 * @returns Non-tool content
	 */
	public appendParsedEvent(event: unknown): string {
		try {
			this.processEvent(event as AnthropicEvent)
			console.log("Processed parsed Anthropic event", event)
		} catch (error) {
			console.error("Error processing parsed Anthropic event:", error)
		}

		const output = this.nonToolBuffer
		this.nonToolBuffer = ""
		return output
	}

	/**
	 * Process an Anthropic event
	 * @param event - The parsed event object
	 */
	private processEvent(event: AnthropicEvent): void {
		switch (event.type) {
			case "message_start":
				// Reset state for new message
				this.handleMessageStart(event as AnthropicMessageStart)
				break

			case "content_block_start":
				if ("content_block" in event) {
					if (event.content_block.type === "tool_use") {
						this.handleToolUseBlockStart(event as AnthropicContentBlockStartToolUse)
					} else if (event.content_block.type === "text") {
						this.handleTextBlockStart(event as AnthropicContentBlockStartText)
					} else if (event.content_block.type === "thinking") {
						this.handleThinkingBlockStart(event as AnthropicContentBlockStartThinking)
					}
				}
				break

			case "content_block_delta":
				if ("delta" in event && "type" in event.delta) {
					if (event.delta.type === "text_delta") {
						this.handleTextDelta(event as AnthropicContentBlockDeltaText)
					} else if (event.delta.type === "thinking_delta") {
						this.handleThinkingDelta(event as AnthropicContentBlockDeltaThinking)
					} else if (event.delta.type === "input_json_delta") {
						this.handleJsonDelta(event as AnthropicContentBlockDeltaJson)
					}
				}
				break

			case "content_block_stop":
				this.handleContentBlockStop(event as AnthropicContentBlockStop)
				break

			case "message_delta":
				// Update message metadata (like stop_reason)
				break

			case "message_stop":
				// End of message, finalize any pending tools
				this.handleMessageStop()
				break
		}
	}

	/**
	 * Handle message_start event
	 */
	private handleMessageStart(event: AnthropicMessageStart): void {
		// Reset state for new message
		this.activeBlocks.clear()
		this.currentTextBuffer = ""
		this.currentToolJsonBuffer = ""
		this.isInNativeThinking = false
		this.currentThinkingBuffer = ""
		this.isInLegacyThinking = false
		this.legacyThinkingBuffer = ""
	}

	/**
	 * Handle content_block_start event for tool_use blocks
	 */
	private handleToolUseBlockStart(event: AnthropicContentBlockStartToolUse): void {
		const { index, content_block } = event

		// Track the block
		this.activeBlocks.set(index, {
			type: content_block.type,
			anthropicId: content_block.id,
			name: content_block.name,
		})

		// Initialize the tool context
		const toolName = content_block.name

		// Verify this is a known tool
		if (this.toolSchemas.some((schema) => schema.name === toolName)) {
			this.isInToolBlock = true

			const id = this.generateId()
			const ts = Date.now()
			this.currentContext = {
				id,
				ts,
				toolName,
				params: content_block.input || {},
				isComplete: false,
				anthropicId: content_block.id,
			}

			// Send initial update with input provided
			this.onToolUpdate?.(id, toolName, this.currentContext.params, ts)
		}
	}

	/**
	 * Handle content_block_start event for text blocks
	 */
	private handleTextBlockStart(event: AnthropicContentBlockStartText): void {
		const { index, content_block } = event

		// Track the block
		this.activeBlocks.set(index, {
			type: content_block.type,
		})

		// Initialize the text buffer
		this.currentTextBuffer = content_block.text || ""

		// Check for legacy thinking tags
		if (this.currentTextBuffer.includes("<thinking>")) {
			this.isInLegacyThinking = true
			this.legacyThinkingBuffer = this.currentTextBuffer
		} else {
			this.nonToolBuffer += this.currentTextBuffer
		}
	}

	/**
	 * Handle content_block_start event for thinking blocks
	 */
	private handleThinkingBlockStart(event: AnthropicContentBlockStartThinking): void {
		const { index, content_block } = event

		// Track the block
		this.activeBlocks.set(index, {
			type: content_block.type,
		})

		// Initialize the thinking buffer
		this.isInNativeThinking = true
		this.currentThinkingBuffer = content_block.thinking || ""

		// Create formatted thinking content in the non-tool buffer
		this.nonToolBuffer += `<thinking>${this.currentThinkingBuffer}`
	}

	/**
	 * Handle text_delta events
	 */
	private handleTextDelta(event: AnthropicContentBlockDeltaText): void {
		const { index, delta } = event
		const blockInfo = this.activeBlocks.get(index)

		if (!blockInfo || blockInfo.type !== "text") {
			return
		}

		// Append to text buffer
		this.currentTextBuffer += delta.text

		// Check for legacy thinking tags in the text
		if (!this.isInLegacyThinking && delta.text.includes("<thinking>")) {
			this.isInLegacyThinking = true
			// Find the start of the thinking tag
			const thinkingStart = this.currentTextBuffer.indexOf("<thinking>")
			// Add text before thinking tag to non-tool buffer
			this.nonToolBuffer += this.currentTextBuffer.substring(0, thinkingStart)
			// Initialize thinking buffer with just the tag
			this.legacyThinkingBuffer = this.currentTextBuffer.substring(thinkingStart)
			return
		}

		if (this.isInLegacyThinking) {
			this.legacyThinkingBuffer += delta.text

			// Check if thinking ended
			if (this.legacyThinkingBuffer.includes("</thinking>")) {
				// Find the end of the thinking tag
				const thinkingEnd = this.legacyThinkingBuffer.indexOf("</thinking>") + "</thinking>".length

				// Add the complete thinking block to non-tool buffer
				this.nonToolBuffer += this.legacyThinkingBuffer.substring(0, thinkingEnd)

				// Reset thinking state
				this.isInLegacyThinking = false

				// Add any text after the closing tag to non-tool buffer
				if (thinkingEnd < this.legacyThinkingBuffer.length) {
					this.nonToolBuffer += this.legacyThinkingBuffer.substring(thinkingEnd)
				}

				this.legacyThinkingBuffer = ""
			}
		} else {
			// Regular text, add to non-tool buffer
			this.nonToolBuffer += delta.text
		}
	}

	/**
	 * Handle thinking_delta events
	 */
	private handleThinkingDelta(event: AnthropicContentBlockDeltaThinking): void {
		const { index, delta } = event
		const blockInfo = this.activeBlocks.get(index)

		if (!blockInfo || blockInfo.type !== "thinking") {
			return
		}

		// Append to thinking buffer
		this.currentThinkingBuffer += delta.thinking

		// Add to non-tool buffer with thinking tags for consistent format
		this.nonToolBuffer += delta.thinking
	}

	/**
	 * Handle input_json_delta events
	 *
	 * When Anthropic streams tool calls, it sends the JSON input in fragments through
	 * multiple content_block_delta events. We need to incrementally parse these fragments
	 * and update the tool parameters in real-time.
	 */
	private handleJsonDelta(event: AnthropicContentBlockDeltaJson): void {
		const { index, delta } = event
		const blockInfo = this.activeBlocks.get(index)

		if (!blockInfo || blockInfo.type !== "tool_use" || !this.currentContext) {
			return
		}

		// Log the incoming JSON fragment for debugging
		console.log(`Received JSON fragment: '${delta.partial_json}'`)

		// Accumulate the JSON fragments
		this.currentToolJsonBuffer += delta.partial_json

		// Try to extract key-value pairs as they come in
		// This approach handles streaming JSON better than waiting for complete JSON
		try {
			// Check if we have a property-value pair pattern
			const propertyMatch = this.currentToolJsonBuffer.match(
				/"([^"]+)"\s*:\s*("[^"]*"|[0-9]+|\{|\[|true|false|null)/
			)

			if (propertyMatch) {
				const key = propertyMatch[1]
				let valueStr = propertyMatch[2]
				let value: any

				// Parse the value based on its type
				if (valueStr.startsWith('"')) {
					// String value
					value = valueStr.replace(/^"|"$/g, "")
				} else if (valueStr === "true") {
					value = true
				} else if (valueStr === "false") {
					value = false
				} else if (valueStr === "null") {
					value = null
				} else if (!isNaN(Number(valueStr))) {
					// Number value
					value = Number(valueStr)
				} else if (valueStr === "{" || valueStr === "[") {
					// Object or array - will need further processing
					// For now, we just note that we have a partial complex value
					console.log(`Detected start of complex value for property ${key}`)
					return
				}

				// Update the current context params with the new value
				if (key && value !== undefined) {
					this.currentContext.params = {
						...this.currentContext.params,
						[key]: value,
					}

					// Send an update with the latest params
					this.onToolUpdate?.(
						this.currentContext.id,
						this.currentContext.toolName,
						this.currentContext.params,
						this.currentContext.ts
					)

					console.log(`Updated tool params with property ${key}:`, value)
				}
			}

			// Also try to parse the entire accumulated JSON if it might be complete
			if (this.currentToolJsonBuffer.trim().startsWith("{") && this.currentToolJsonBuffer.trim().endsWith("}")) {
				try {
					const params = JSON.parse(this.currentToolJsonBuffer)

					// Only update if we got a valid object
					if (typeof params === "object" && params !== null) {
						this.currentContext.params = params

						// Send a complete update
						this.onToolUpdate?.(
							this.currentContext.id,
							this.currentContext.toolName,
							this.currentContext.params,
							this.currentContext.ts
						)

						console.log(`Parsed complete JSON params:`, params)
					}
				} catch (e) {
					// Ignore errors from incomplete JSON
					// This is expected during streaming
				}
			}
		} catch (error) {
			// Ignore errors from partial JSON parsing
			// This is expected during streaming
		}
	}

	/**
	 * Handle content_block_stop event
	 */
	private handleContentBlockStop(event: AnthropicContentBlockStop): void {
		const { index } = event
		const blockInfo = this.activeBlocks.get(index)

		if (!blockInfo) {
			return
		}

		if (blockInfo.type === "text") {
			// Add any remaining text to non-tool buffer
			if (this.currentTextBuffer && !this.isInLegacyThinking) {
				this.nonToolBuffer += this.currentTextBuffer
			}
			this.currentTextBuffer = ""
		} else if (blockInfo.type === "thinking") {
			// Add closing thinking tag to the non-tool buffer
			if (this.isInNativeThinking) {
				this.nonToolBuffer += "</thinking>"
				this.isInNativeThinking = false
				this.currentThinkingBuffer = ""
			}
		} else if (blockInfo.type === "tool_use" && this.currentContext) {
			// Finalize the tool if it matches the current context
			if (blockInfo.anthropicId === this.currentContext.anthropicId) {
				// At this point, we should have the complete JSON input for the tool
				console.log(`Finalizing tool with JSON buffer: '${this.currentToolJsonBuffer}'`)

				let finalParams = this.currentContext.params

				// Make one final attempt to parse any accumulated JSON
				if (this.currentToolJsonBuffer.trim()) {
					try {
						// Handle cases where we might have JSON without surrounding braces
						let jsonStr = this.currentToolJsonBuffer

						if (!jsonStr.startsWith("{")) {
							// Check if this is a valid property format like 'key': value
							if (jsonStr.includes(":")) {
								jsonStr = `{${jsonStr}}`
							} else {
								// If not, we likely have invalid JSON
								throw new Error(`Invalid JSON format: ${jsonStr}`)
							}
						}

						// Parse the complete JSON
						const parsedParams = JSON.parse(jsonStr)

						if (typeof parsedParams === "object" && parsedParams !== null) {
							// Only update if we got a valid object
							finalParams = parsedParams
							console.log(`Successfully parsed final tool params:`, finalParams)
						}
					} catch (error) {
						console.error(`Error parsing final JSON for tool ${this.currentContext.toolName}:`, error)
						console.log(`Using previously accumulated params instead:`, finalParams)
					}
				}

				// Finalize the tool with our best parameters
				this.validateAndFinalizeTool(
					this.currentContext.toolName,
					finalParams,
					this.currentContext.id,
					this.currentContext.ts
				)

				// Reset state
				this.isInToolBlock = false
				this.currentContext = null
				this.currentToolJsonBuffer = ""
			}
		}

		// Remove the block from tracking
		this.activeBlocks.delete(index)
	}

	/**
	 * Handle message_stop event
	 */
	private handleMessageStop(): void {
		// Finalize any pending context
		if (this.currentContext) {
			this.validateAndFinalizeTool(
				this.currentContext.toolName,
				this.currentContext.params,
				this.currentContext.id,
				this.currentContext.ts
			)

			this.isInToolBlock = false
			this.currentContext = null
		}

		// Add closing thinking tag if needed
		if (this.isInNativeThinking) {
			this.nonToolBuffer += "</thinking>"
			this.isInNativeThinking = false
		}

		// Clear all state
		this.activeBlocks.clear()
		this.currentTextBuffer = ""
		this.currentToolJsonBuffer = ""
		this.currentThinkingBuffer = ""
	}

	/**
	 * Signal the end of parsing, handling any unclosed tools
	 */
	public endParsing(): void {
		if (this.currentContext) {
			this.onToolClosingError?.(new Error("Unclosed tool block at end of input"))
		}

		// Add closing thinking tag if needed
		if (this.isInNativeThinking) {
			this.nonToolBuffer += "</thinking>"
		}
	}

	/**
	 * Reset the parser state
	 */
	public reset(): void {
		this.currentContext = null
		this.isInToolBlock = false
		this.nonToolBuffer = ""
		this.currentTextBuffer = ""
		this.currentToolJsonBuffer = ""
		this.isInNativeThinking = false
		this.currentThinkingBuffer = ""
		this.isInLegacyThinking = false
		this.legacyThinkingBuffer = ""
		this.activeBlocks.clear()
	}
}
