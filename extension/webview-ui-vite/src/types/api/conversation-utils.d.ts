import Anthropic from "@anthropic-ai/sdk";
import { ApiHandler } from ".";
import { MainAgent } from "../agent/v1/main-agent";
/**
 * @danger This function is mutating the history object
 * Processes the conversation history and manages context window
 * @param provider - The provider instance
 * @param history - Conversation history to process, this will be mutated.
 * @mutates history to add critical messages and environment details to the last message
 */
export declare function processConversationHistory(provider: MainAgent, history: Anthropic.MessageParam[], criticalMsg?: string, 
/**
 * Whether to save the conversation to state and disk after processing
 */
autoSaveToDisk?: boolean): Promise<void>;
/**
 * remove duplicate content from the messages
 */
export declare function removeDuplicateContent(messages: Anthropic.MessageParam[]): Anthropic.Messages.MessageParam[];
/**
 * Enriches conversation history with environment details and critical messages
 * @param provider - The provider instance
 * @param history - Conversation history to enrich
 * @param isLastMessageFromUser - Whether the last message was from the user
 */
export declare function enrichConversationHistory(provider: MainAgent, history: Anthropic.MessageParam[], isLastMessageFromUser: boolean, criticalMsg?: string): Promise<void>;
/**
 * Manages the context window to prevent token overflow
 * @param provider - The provider instance
 * @param api - The api handler instance
 * @param currentSystemPrompt - The current system prompt string
 * @param getApiMetricsFn - Function to get API metrics
 * @param logFn - Logging function
 * @returns "chat_finished" or "compressed"
 */
export declare function manageContextWindow(provider: MainAgent, api: ApiHandler, logFn: (status: "info" | "debug" | "error", message: string, ...args: any[]) => void): Promise<"chat_finished" | "compressed">;
