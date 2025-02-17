/**
 * @fileoverview API Manager for handling Claude API interactions
 * This module manages API communications with the Anthropic Claude API, handling message streams,
 * token calculations, and conversation history management.
 */
import { ApiConstructorOptions, ApiHandler } from ".";
import { ExtensionProvider } from "../providers/extension-provider";
import { koduSSEResponse } from "../shared/kodu";
import { ApiHistoryItem } from "../agent/v1/types";
/**
 * Main API Manager class that handles all Claude API interactions
 */
export declare class ApiManager {
    private api;
    private customInstructions?;
    private providerRef;
    constructor(provider: ExtensionProvider, apiConfiguration: ApiConstructorOptions, customInstructions?: string);
    /**
     * Returns the current API handler instance
     */
    getApi(): ApiHandler;
    /**
     * Returns the current model ID
     */
    getModelId(): string;
    getModelInfo(): import("./providers/types").ModelInfo;
    /**
     * Updates the API configuration
     * @param apiConfiguration - New API configuration
     */
    updateApi(apiConfiguration: ApiConstructorOptions): void;
    /**
     * pulls the latest API from the secure store and rebuilds the API handler
     */
    pullLatestApi(): Promise<void>;
    /**
     * Updates custom instructions for the API
     * @param customInstructions - New custom instructions
     */
    updateCustomInstructions(customInstructions: string | undefined): void;
    /**
     * Formats custom instructions with proper sectioning
     * @returns Formatted custom instructions string
     */
    formatCustomInstructions(): string | undefined;
    /**
     * Creates a streaming API request
     * @param apiConversationHistory - Conversation history
     * @param abortController - Optional abort signal for cancelling requests
     * @returns AsyncGenerator yielding SSE responses
     */
    createApiStreamRequest(apiConversationHistory: ApiHistoryItem[], abortController: AbortController, customSystemPrompt?: {
        automaticReminders?: string;
        systemPrompt?: string | [];
        customInstructions?: string;
        useExistingSystemPrompt?: (systemPrompt: string[]) => string[];
    }, skipProcessing?: boolean, postProcessConversationCallback?: (apiConversationHistory: ApiHistoryItem[]) => Promise<void>): AsyncGenerator<koduSSEResponse>;
    /**
     * Processes stream chunks from the API response
     * @param chunk - SSE response chunk
     */
    private processStreamChunk;
    /**
     * Handles the final response from the API
     * @param chunk - Final response chunk
     */
    private handleFinalResponse;
    private getCurrentPrompts;
    /**
     * Handles stream errors
     * @param error - Error from the stream
     */
    private handleStreamError;
    private getTaskText;
    private log;
}
