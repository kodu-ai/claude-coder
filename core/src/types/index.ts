import { Anthropic } from "@anthropic-ai/sdk";

export type ClaudeAskResponse = string; // This should be replaced with the actual type when available

export type ToolName = string; // This should be replaced with the actual type when available

export interface ToolInput {
  // Define the structure of ToolInput here
}

export interface ToolResponse {
  // Define the structure of ToolResponse here
}

export type UserContent = Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>;

// Export other types that might be used across the application
export { State } from './state';
export { ClaudeMessage } from './state';
export { ApiConversationHistoryItem } from './state';