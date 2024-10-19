import { ToolName, ToolInput, ToolResponse } from '../types';

/**
 * Manages the execution of tools within the application.
 */
export interface IToolRunner {
  /**
   * Runs a specific tool with the given input.
   * @param name - The name of the tool to run
   * @param input - The input for the tool
   * @returns A promise that resolves with the tool execution response
   * @throws {Error} If the tool execution fails
   */
  run(name: ToolName, input: ToolInput): Promise<ToolResponse>;

  /**
   * Initializes the tool runner with any necessary setup.
   * @returns A promise that resolves when initialization is complete
   * @throws {Error} If initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Checks if a specific tool is available to run.
   * @param name - The name of the tool to check
   * @returns True if the tool is available, false otherwise
   */
  isToolAvailable(name: ToolName): boolean;

  /**
   * Retrieves the list of available tools.
   * @returns An array of available tool names
   */
  getAvailableTools(): ToolName[];

  /**
   * Validates the input for a specific tool.
   * @param name - The name of the tool
   * @param input - The input to validate
   * @returns True if the input is valid, false otherwise
   * @throws {Error} If the validation process itself fails
   */
  validateToolInput(name: ToolName, input: ToolInput): boolean;

  /**
   * Cleans up any resources used by the tool runner.
   * @returns A promise that resolves when cleanup is complete
   * @throws {Error} If cleanup fails
   */
  cleanup(): Promise<void>;

  /**
   * Handles errors that occur during tool execution.
   * @param error - The error that occurred
   * @param name - The name of the tool that caused the error
   * @returns A promise that resolves with an error response
   */
  handleToolError(error: Error, name: ToolName): Promise<ToolResponse>;
}