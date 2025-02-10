import { ApiHistoryItem } from "../agent/v1/main-agent";
import { ClaudeMessage } from "../shared/messages/extension-message";
import { ModelInfo } from "./providers/types";
export interface ApiMetrics {
    inputTokens: number;
    outputTokens: number;
    inputCacheRead: number;
    inputCacheWrite: number;
    cost: number;
}
/**
 * Calculates the API cost based on token usage
 * @param modelInfo - The model info object containing pricing details
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param cacheCreationInputTokens - Number of cache creation tokens
 * @param cacheReadInputTokens - Number of cache read tokens
 * @returns Total API cost
 */
export declare function calculateApiCost(modelInfo: ModelInfo, inputTokens: number, outputTokens: number, cacheCreationInputTokens?: number, cacheReadInputTokens?: number): number;
/**
 * Cleans up an Anthropic message, removing empty content blocks.
 * @param msg Anthropics message param
 * @returns Cleaned up message or null if empty
 */
export declare function cleanUpMsg(msg: ApiHistoryItem): ApiHistoryItem | null;
/**
 * Retrieves and processes API metrics from conversation history
 * @param claudeMessages - Conversation history
 * @returns Processed API metrics
 */
export declare function getApiMetrics(claudeMessages: ClaudeMessage[]): ApiMetrics;
