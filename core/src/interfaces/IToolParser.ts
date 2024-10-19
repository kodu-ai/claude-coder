import { ToolName, ToolInput } from '../types';

/**
 * Represents the result of parsing a tool string.
 */
export interface ParsedTool {
  name: ToolName;
  input: ToolInput;
}

/**
 * Manages the parsing of tool strings into structured tool data.
 */
export interface IToolParser {
  /**
   * Initializes the tool parser with any necessary configuration.
   * @param config - The configuration object for the parser
   * @returns A promise that resolves when initialization is complete
   * @throws {Error} If initialization fails
   */
  initialize(config: Record<string, unknown>): Promise<void>;

  /**
   * Parses a tool string into a structured tool object.
   * @param toolString - The string representation of the tool to parse
   * @returns A promise that resolves with the parsed tool object
   * @throws {Error} If the tool string is invalid or cannot be parsed
   */
  parse(toolString: string): Promise<ParsedTool>;

  /**
   * Validates if a given string is a valid tool string.
   * @param toolString - The string to validate
   * @returns True if the string is a valid tool string, false otherwise
   */
  isValidToolString(toolString: string): boolean;

  /**
   * Generates a tool string from a ParsedTool object.
   * @param tool - The ParsedTool object to convert to a string
   * @returns The string representation of the tool
   */
  stringify(tool: ParsedTool): string;

  /**
   * Retrieves the list of supported tool names.
   * @returns An array of supported tool names
   */
  getSupportedToolNames(): ToolName[];

  /**
   * Handles errors that occur during parsing operations.
   * @param error - The error that occurred
   * @param toolString - The original tool string that caused the error
   * @returns A promise that resolves with an error response
   */
  handleParsingError(error: Error, toolString: string): Promise<string>;
}