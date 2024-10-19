import { ToolName, ToolInput, ToolResponse } from '../types';

/**
 * Parameters for executing a tool.
 */
export interface ExecuteToolParams {
  /** The name of the tool to execute */
  name: ToolName;
  /** The input for the tool */
  input: ToolInput;
  /** A unique identifier for this tool execution */
  id: string;
  /** Timestamp of the tool execution */
  ts: number;
  /** Indicates if this is the last write to file operation */
  isLastWriteToFile: boolean;
  /** Function to ask for additional information during tool execution */
  ask: (askType: string) => Promise<any>;
  /** Function to provide output during tool execution */
  say: (sayType: string, text?: string, images?: string[]) => Promise<void>;
}

/**
 * Manages the execution of tools within the application.
 */
export interface IToolExecutor {
  /**
   * Executes a specified tool with the given parameters.
   * @param params - The parameters for tool execution
   * @returns A promise that resolves with the tool execution response
   */
  executeTool(params: ExecuteToolParams): Promise<ToolResponse>;

  /**
   * Retrieves the list of available tools.
   * @returns An array of available tool names
   */
  getAvailableTools(): ToolName[];

  /**
   * Checks if a specific tool is available.
   * @param name - The name of the tool to check
   * @returns True if the tool is available, false otherwise
   */
  isToolAvailable(name: ToolName): boolean;

  /**
   * Retrieves the description of a specific tool.
   * @param name - The name of the tool to get the description for
   * @returns The description of the tool, or undefined if the tool doesn't exist
   */
  getToolDescription(name: ToolName): string | undefined;
}