import { ClaudeAskResponse, ToolName, ToolInput, ToolResponse, UserContent } from "../types/index"
import { IStateManager } from "./IStateManager"
import { IApiManager } from "./IApiManager"
import { IBrowserManager } from "./IBrowserManager"
import { IDiagnosticsHandler } from "./IDiagnosticsHandler"
import { BrowserService } from "@/services"
import { StateService } from "@/singletons/state/state.service"
import { AdvancedTerminalManager } from "@/integrations"
import { KoduApiService } from "@/singletons"

/**
 * Main interface for the Kodu Development environment.
 */
export interface IKoduDev {
	/**
	 * Handles the response from the webview ask operation.
	 * @param askResponse - The response from the ask operation
	 * @param text - Optional text content
	 * @param images - Optional array of image URLs
	 */
	handleWebviewAskResponse(askResponse: ClaudeAskResponse, text?: string, images?: string[]): Promise<void>

	/**
	 * Starts a new task with optional initial content.
	 * @param task - Optional task description
	 * @param images - Optional array of image URLs
	 */
	startTask(task?: string, images?: string[]): Promise<void>

	/**
	 * Resumes a task from its saved history.
	 */
	resumeTaskFromHistory(): Promise<void>

	/**
	 * Aborts the current task.
	 */
	abortTask(): Promise<void>

	/**
	 * Executes a specific tool.
	 * @param name - The name of the tool to execute
	 * @param input - The input for the tool
	 * @param isLastWriteToFile - Indicates if this is the last write operation to a file
	 * @returns A promise that resolves with the tool execution response
	 */
	executeTool(name: ToolName, input: ToolInput, isLastWriteToFile: boolean): Promise<ToolResponse>

	/**
	 * Retrieves environment details.
	 * @param includeFileDetails - Whether to include file details in the environment information
	 * @returns A promise that resolves with a string containing environment details
	 */
	getEnvironmentDetails(includeFileDetails: boolean): Promise<string>

	/**
	 * Gets the state manager instance.
	 */
	getStateManager(): IStateManager

	/**
	 * Gets the API manager instance.
	 */
	getApiManager(): IApiManager

	/**
	 * Gets the browser manager instance.
	 */
	getBrowserManager(): IBrowserManager

	/**
	 * Gets the diagnostics handler instance.
	 */
	getDiagnosticsHandler(): IDiagnosticsHandler

	// @TODO: change back to Service?
	terminalManager: AdvancedTerminalManager

	browserService: BrowserService
}

/**
 * Interface for task execution related operations.
 */
export interface ITaskOperations {
	startTask(task?: string, images?: string[]): Promise<void>
	resumeTaskFromHistory(): Promise<void>
	abortTask(): Promise<void>
}

/**
 * Interface for tool execution related operations.
 */
export interface IToolOperations {
	executeTool(name: ToolName, input: ToolInput, isLastWriteToFile: boolean): Promise<ToolResponse>
}

/**
 * Interface for environment-related operations.
 */
export interface IEnvironmentOperations {
	getEnvironmentDetails(includeFileDetails: boolean): Promise<string>
}
