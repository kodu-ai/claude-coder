import { 
    BaseDialectParser, 
    DialectParserConstructor, 
    ToolSchema, 
    IEventStreamDialectParser 
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
    | AnthropicContentBlockDeltaText
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
    readonly dialectType = "anthropic-json" as const;
    
    private currentContext: AnthropicJsonContext | null = null
    private isInToolBlock: boolean = false
    private nonToolBuffer: string = ""
    private currentTextBuffer: string = ""
    private currentToolJsonBuffer: string = ""
    private isThinking: boolean = false
    private thinkingBuffer: string = ""
    
    /**
     * Map to track active content blocks by index
     */
    private activeBlocks: Map<number, { type: string; anthropicId?: string; name?: string }> = new Map()

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
        const lines = text.split("\n").filter(line => line.trim() !== "")
        
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
                if ('content_block' in event && event.content_block.type === "tool_use") {
                    this.handleToolUseBlockStart(event as AnthropicContentBlockStartToolUse)
                } else if ('content_block' in event && event.content_block.type === "text") {
                    this.handleTextBlockStart(event as AnthropicContentBlockStartText)
                }
                break
                
            case "content_block_delta":
                if ("delta" in event && "type" in event.delta) {
                    if (event.delta.type === "text_delta") {
                        this.handleTextDelta(event as AnthropicContentBlockDeltaText)
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
        this.isThinking = false
        this.thinkingBuffer = ""
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
            name: content_block.name
        })
        
        // Initialize the tool context
        const toolName = content_block.name
        
        // Verify this is a known tool
        if (this.toolSchemas.some(schema => schema.name === toolName)) {
            this.isInToolBlock = true
            
            const id = this.generateId()
            const ts = Date.now()
            this.currentContext = {
                id,
                ts,
                toolName,
                params: content_block.input || {},
                isComplete: false,
                anthropicId: content_block.id
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
            type: content_block.type
        })
        
        // Initialize the text buffer
        this.currentTextBuffer = content_block.text || ""
        
        // Check for thinking tags
        if (this.currentTextBuffer.includes("<thinking>")) {
            this.isThinking = true
            this.thinkingBuffer = this.currentTextBuffer
        } else {
            this.nonToolBuffer += this.currentTextBuffer
        }
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
        
        // Check for thinking tags in the text
        if (!this.isThinking && delta.text.includes("<thinking>")) {
            this.isThinking = true
            // Find the start of the thinking tag
            const thinkingStart = this.currentTextBuffer.indexOf("<thinking>")
            // Add text before thinking tag to non-tool buffer
            this.nonToolBuffer += this.currentTextBuffer.substring(0, thinkingStart)
            // Initialize thinking buffer with just the tag
            this.thinkingBuffer = this.currentTextBuffer.substring(thinkingStart)
            return
        }
        
        if (this.isThinking) {
            this.thinkingBuffer += delta.text
            
            // Check if thinking ended
            if (this.thinkingBuffer.includes("</thinking>")) {
                // Find the end of the thinking tag
                const thinkingEnd = this.thinkingBuffer.indexOf("</thinking>") + "</thinking>".length
                
                // Add the complete thinking block to non-tool buffer
                this.nonToolBuffer += this.thinkingBuffer.substring(0, thinkingEnd)
                
                // Reset thinking state
                this.isThinking = false
                
                // Add any text after the closing tag to non-tool buffer
                if (thinkingEnd < this.thinkingBuffer.length) {
                    this.nonToolBuffer += this.thinkingBuffer.substring(thinkingEnd)
                }
                
                this.thinkingBuffer = ""
            }
        } else {
            // Regular text, add to non-tool buffer
            this.nonToolBuffer += delta.text
        }
    }

    /**
     * Handle input_json_delta events
     */
    private handleJsonDelta(event: AnthropicContentBlockDeltaJson): void {
        const { index, delta } = event
        const blockInfo = this.activeBlocks.get(index)
        
        if (!blockInfo || blockInfo.type !== "tool_use" || !this.currentContext) {
            return
        }
        
        // Append to JSON buffer
        this.currentToolJsonBuffer += delta.partial_json
        
        // Try to parse the accumulated JSON
        if (this.currentToolJsonBuffer.trim()) {
            try {
                // Sometimes the partial JSON might not be valid yet, so we add temporary braces
                let jsonStr = this.currentToolJsonBuffer
                if (!jsonStr.startsWith("{")) jsonStr = "{" + jsonStr
                if (!jsonStr.endsWith("}")) jsonStr = jsonStr + "}"
                
                const params = JSON.parse(jsonStr)
                
                // Update tool parameters
                this.currentContext.params = { ...params }
                
                // Send progress update
                this.onToolUpdate?.(
                    this.currentContext.id,
                    this.currentContext.toolName,
                    this.currentContext.params,
                    this.currentContext.ts
                )
            } catch (error) {
                // Ignore parsing errors for partial JSON
            }
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
            if (this.currentTextBuffer && !this.isThinking) {
                this.nonToolBuffer += this.currentTextBuffer
            }
            this.currentTextBuffer = ""
        } else if (blockInfo.type === "tool_use" && this.currentContext) {
            // Finalize the tool if it matches the current context
            if (blockInfo.anthropicId === this.currentContext.anthropicId) {
                // Try to parse the final JSON
                if (this.currentToolJsonBuffer.trim()) {
                    try {
                        const params = JSON.parse(
                            this.currentToolJsonBuffer.startsWith("{") 
                                ? this.currentToolJsonBuffer 
                                : `{${this.currentToolJsonBuffer}}`
                        )
                        
                        // Update and finalize tool
                        this.validateAndFinalizeTool(
                            this.currentContext.toolName,
                            params,
                            this.currentContext.id,
                            this.currentContext.ts
                        )
                    } catch (error) {
                        // If we can't parse the JSON, use the current params
                        this.validateAndFinalizeTool(
                            this.currentContext.toolName,
                            this.currentContext.params,
                            this.currentContext.id,
                            this.currentContext.ts
                        )
                    }
                } else {
                    // Finalize with current params if no JSON buffer
                    this.validateAndFinalizeTool(
                        this.currentContext.toolName,
                        this.currentContext.params,
                        this.currentContext.id,
                        this.currentContext.ts
                    )
                }
                
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
        
        // Clear all state
        this.activeBlocks.clear()
        this.currentTextBuffer = ""
        this.currentToolJsonBuffer = ""
    }

    /**
     * Signal the end of parsing, handling any unclosed tools
     */
    public endParsing(): void {
        if (this.currentContext) {
            this.onToolClosingError?.(new Error("Unclosed tool block at end of input"))
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
        this.isThinking = false
        this.thinkingBuffer = ""
        this.activeBlocks.clear()
    }
}