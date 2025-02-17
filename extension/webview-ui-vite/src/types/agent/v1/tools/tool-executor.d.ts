/**
 * @fileoverview Tool Executor manages the lifecycle and execution of various tools in the Kodu extension.
 * It handles tool creation, execution queuing, state management, and cleanup of running tools.
 */
import { ToolResponseV2 } from "../types";
import { AgentToolOptions } from "./types";
/**
 * Manages the execution and lifecycle of tools in the Kodu extension
 * Handles tool creation, queuing, state management, and cleanup
 */
export declare class ToolExecutor {
    /** Process ID of the currently running tool, if any */
    private runningProcessId;
    /** Current working directory for tool execution */
    private readonly cwd;
    /** Reference to the KoduDev instance */
    private readonly koduDev;
    /** Parser for handling tool commands and updates */
    private readonly toolParser;
    /** Queue for managing sequential tool execution */
    private readonly queue;
    /** Map of active tool contexts indexed by their IDs */
    private toolContexts;
    /** Array of completed tool execution results */
    private toolResults;
    /** Flag indicating if tool execution is being aborted */
    private isAborting;
    /**
     * Creates a new ToolExecutor instance
     * @param options Configuration options for the tool executor
     */
    constructor(options: AgentToolOptions);
    /**
     * Gets the current tool execution options
     * @returns Configuration options for tool execution
     */
    get options(): AgentToolOptions;
    /**
     * Checks if there are any tools currently active or queued
     * @returns True if there are active or queued tools, false otherwise
     */
    hasActiveTools(): boolean;
    /**
     * Creates a new tool instance based on the provided parameters
     * @param params Parameters for creating the tool
     * @returns New instance of the specified tool
     * @throws Error if the tool type is unknown
     */
    private createTool;
    /**
     * Sets the ID of the currently running process
     * @param pid Process ID to set, or undefined to clear
     */
    setRunningProcessId(pid: number | undefined): void;
    /**
     * Aborts all currently running tools and cleans up resources
     * Kills running processes, clears the queue, and resets tool states
     */
    abortTask(): Promise<void>;
    /**
     * Processes a tool use command from text input
     * @param text The tool use command text to process
     * @returns Object containing the processed output
     */
    processToolUse(text: string): Promise<string>;
    /**
     * Waits for all queued and active tools to complete processing
     * Uses polling to check the queue status at regular intervals
     */
    waitForToolProcessing(): Promise<void>;
    /**
     * Handles updates to a tool's state during execution
     * @param id Tool context ID
     * @param toolName Name of the tool
     * @param params Updated tool parameters
     * @param ts Timestamp of the update
     */
    private handleToolUpdate;
    /**
     * Handles the completion of a tool's execution
     * @param id Tool context ID
     * @param toolName Name of the tool
     * @param params Final tool parameters
     */
    private handleToolEnd;
    /**
     * Handles errors that occur during tool execution
     * @param id Tool context ID
     * @param toolName Name of the tool
     * @param error Error that occurred
     * @param ts Timestamp of the error
     */
    private handleToolError;
    /**
     * Updates the status of a tool in the UI
     * @param context Tool context to update
     * @param params Parameters for the update
     * @param ts Timestamp of the update
     */
    private updateToolStatus;
    /**
     * Checks if the parser is currently within a tool tag
     * @returns True if parser is in a tool tag, false otherwise
     */
    isParserInToolTag(): boolean;
    /**
     * Processes a single tool execution
     * Handles the complete lifecycle of a tool from start to completion
     * @param context Context of the tool to process
     */
    private processTool;
    /**
     * Gets the results of all completed tool executions
     * @returns Array of tool execution results
     */
    getToolResults(): {
        name: string;
        result: ToolResponseV2;
    }[];
    /**
     * Resets the tool executor state
     * Aborts any running tasks and clears results
     */
    resetToolState(): Promise<void>;
}
