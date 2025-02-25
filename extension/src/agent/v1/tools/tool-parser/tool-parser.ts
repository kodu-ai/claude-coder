import { z } from "zod"
import { tools } from "../schema"
import {
	IDialectParser,
	DialectParserConstructor,
	ToolSchema,
	DialectType,
	createDialectParser,
	isEventStreamDialectParser,
} from "./base-dialect-parser"

type ToolUpdateCallback = (id: string, toolName: string, params: any, ts: number) => Promise<void>
type ToolEndCallback = (id: string, toolName: string, params: any, ts: number) => Promise<void>
type ToolErrorCallback = (id: string, toolName: string, error: Error, ts: number) => Promise<void>
type ToolClosingErrorCallback = (error: Error) => Promise<void>

/**
 * Configuration options for the Tool Parser
 */
export interface ToolParserConfig extends DialectParserConstructor {
	/**
	 * The dialect to use for parsing tools
	 * @default "xml"
	 */
	dialect?: DialectType
}

/**
 * The main ToolParser class that serves as a facade for different dialect parsers
 */
export class ToolParser {
	private dialectParser: IDialectParser

	/**
	 * Creates a new ToolParser
	 * @param toolSchemas - Array of tool schemas
	 * @param options - Parser configuration options
	 * @param isMock - Flag for mocking (testing)
	 */
	constructor(toolSchemas: ToolSchema[], options: ToolParserConfig, isMock = false) {
		// Create the dialect parser based on the specified or default dialect
		this.dialectParser = createDialectParser(options.dialect || "xml", toolSchemas, {
			...options,
			isMock,
		})
	}

	/**
	 * Gets whether the parser is currently processing a tool
	 */
	get isInToolTag(): boolean {
		return this.dialectParser.isInToolTag
	}

	/**
	 * Process a text chunk and extract tool calls
	 * @param text - Text chunk to process
	 * @returns Non-tool content
	 */
	public appendText(text: string): string {
		return this.dialectParser.appendText(text)
	}

	/**
	 * Process a parsed event object directly (for event stream dialects)
	 * @param event - Parsed event object to process
	 * @returns Non-tool content or empty string if not supported
	 */
	public appendParsedEvent(event: unknown): string {
		if (isEventStreamDialectParser(this.dialectParser)) {
			return this.dialectParser.appendParsedEvent(event)
		}
		console.warn("Current dialect does not support direct event objects")
		return ""
	}

	/**
	 * Signal the end of parsing, handling any unclosed tools
	 */
	public endParsing(): void {
		this.dialectParser.endParsing()
	}

	/**
	 * Reset the parser state
	 */
	public reset(): void {
		this.dialectParser.reset()
	}
}

export default ToolParser
