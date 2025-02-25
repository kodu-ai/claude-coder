import { z } from "zod"
import { nanoid } from "nanoid"

/**
 * Type definitions for tool schema and callbacks
 */
export type ToolSchema = {
	name: string
	schema: z.ZodObject<any>
}

export type ToolUpdateCallback = (id: string, toolName: string, params: any, ts: number) => Promise<void>
export type ToolEndCallback = (id: string, toolName: string, params: any, ts: number) => Promise<void>
export type ToolErrorCallback = (id: string, toolName: string, error: Error, ts: number) => Promise<void>
export type ToolClosingErrorCallback = (error: Error) => Promise<void>

/**
 * Interface for all parser constructor options
 */
export interface DialectParserConstructor {
	onToolUpdate?: ToolUpdateCallback
	onToolEnd?: ToolEndCallback
	onToolError?: ToolErrorCallback
	onToolClosingError?: ToolClosingErrorCallback
	isMock?: boolean
}

/**
 * Supported dialect types
 */
export type DialectType = "xml" | "json" | "anthropic-json"

/**
 * Base interface that all dialect parsers must implement
 */
export interface IDialectParser {
	/**
	 * The type of dialect this parser handles
	 */
	readonly dialectType: DialectType

	/**
	 * Indicates if the parser is currently processing a tool
	 */
	readonly isInToolTag: boolean

	/**
	 * Process a chunk of text and return any non-tool content
	 * @param text - Text chunk to process
	 * @returns Non-tool content
	 */
	appendText(text: string): string

	/**
	 * Signal the end of parsing, handling any unclosed tools
	 */
	endParsing(): void

	/**
	 * Reset the parser state
	 */
	reset(): void
}

/**
 * Interface for text-based dialect parsers (XML, JSON)
 */
export interface ITextDialectParser extends IDialectParser {
	dialectType: "xml" | "json"
}

/**
 * Interface for event stream-based dialect parsers (Anthropic)
 */
export interface IEventStreamDialectParser extends IDialectParser {
	dialectType: "anthropic-json"

	/**
	 * Process a parsed event object directly (for event stream dialects)
	 * @param event - Parsed event object to process
	 * @returns Non-tool content
	 */
	appendParsedEvent(event: unknown): string
}

/**
 * Type guard to check if a parser supports event streams
 */
export function isEventStreamDialectParser(parser: IDialectParser): parser is IEventStreamDialectParser {
	return parser.dialectType === "anthropic-json"
}

/**
 * Abstract base class for implementing dialect parsers
 */
export abstract class BaseDialectParser implements IDialectParser {
	/**
	 * The type of dialect this parser handles
	 */
	abstract readonly dialectType: DialectType
	protected toolSchemas: ToolSchema[]
	protected isMock: boolean

	public onToolUpdate?: ToolUpdateCallback
	public onToolEnd?: ToolEndCallback
	public onToolError?: ToolErrorCallback
	public onToolClosingError?: ToolClosingErrorCallback

	constructor(
		toolSchemas: ToolSchema[],
		{ onToolUpdate, onToolEnd, onToolError, onToolClosingError, isMock = false }: DialectParserConstructor
	) {
		this.toolSchemas = toolSchemas
		this.onToolUpdate = onToolUpdate
		this.onToolEnd = onToolEnd
		this.onToolError = onToolError
		this.onToolClosingError = onToolClosingError
		this.isMock = isMock
	}

	abstract get isInToolTag(): boolean
	abstract appendText(text: string): string
	abstract endParsing(): void
	abstract reset(): void

	/**
	 * Generate a unique ID for a tool call
	 * @returns Unique ID string
	 */
	protected generateId(): string {
		return this.isMock ? "mocked-nanoid" : nanoid()
	}

	/**
	 * Validate and finalize tool parameters using the tool's schema
	 * @param toolName - Name of the tool
	 * @param params - Parameters to validate
	 * @param contextId - Context ID for the tool call
	 * @param timestamp - Timestamp of the tool call
	 */
	protected validateAndFinalizeTool(
		toolName: string,
		params: Record<string, any>,
		contextId: string,
		timestamp: number
	): void {
		const toolSchema = this.toolSchemas.find((schema) => schema.name === toolName)

		if (!toolSchema) {
			this.onToolError?.(contextId, toolName, new Error(`Unknown tool: ${toolName}`), timestamp)
			return
		}

		try {
			const validatedParams = toolSchema.schema.parse(params)
			this.onToolEnd?.(contextId, toolName, validatedParams, timestamp)
		} catch (error) {
			if (error instanceof z.ZodError) {
				this.onToolError?.(contextId, toolName, new Error(`Validation error: ${error.message}`), timestamp)
			} else {
				this.onToolError?.(contextId, toolName, error as Error, timestamp)
			}
		}
	}
}

/**
 * Factory function to create a dialect parser instance
 * @param dialect - The dialect type to create
 * @param toolSchemas - Array of tool schemas
 * @param options - Constructor options
 * @returns An instance of the requested dialect parser
 */
export function createDialectParser(
	dialect: DialectType,
	toolSchemas: ToolSchema[],
	options: DialectParserConstructor
): IDialectParser {
	// Import on-demand to avoid circular dependencies
	const { XmlDialectParser } = require("./xml-dialect-parser")
	const { JsonDialectParser } = require("./json-dialect-parser")
	const { AnthropicJsonDialectParser } = require("./anthropic-json-dialect-parser")

	switch (dialect) {
		case "xml":
			return new XmlDialectParser(toolSchemas, options)
		case "json":
			return new JsonDialectParser(toolSchemas, options)
		case "anthropic-json":
			return new AnthropicJsonDialectParser(toolSchemas, options)
		default:
			// This should never happen due to DialectType definition,
			// but included for safety
			throw new Error(`Unsupported dialect type: ${dialect}`)
	}
}
