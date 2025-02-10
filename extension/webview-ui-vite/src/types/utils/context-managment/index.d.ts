import { Anthropic } from "@anthropic-ai/sdk";
import { compressToolFromMsg } from "./compress-chat";
export declare const isTextBlock: (block: any) => block is Anthropic.TextBlockParam;
export declare const isImageBlock: (block: any) => block is Anthropic.ImageBlockParam;
export declare function truncateHalfConversation(messages: Anthropic.Messages.MessageParam[]): Anthropic.Messages.MessageParam[];
/**
 * Truncates tool calls except for the most recent messages
 * @param messages Array of message parameters
 * @returns Compressed messages array
 */
export declare function smartTruncation(...args: Parameters<typeof compressToolFromMsg>): Promise<Anthropic.Messages.MessageParam[]>;
/**
 * Estimates token count from a message using character-based heuristics
 * @param message - The message to analyze
 * @returns Estimated token count
 */
export declare const estimateTokenCount: (message: Anthropic.MessageParam) => number;
/**
 * Estimates total token count from an array of messages
 * @param messages Array of messages to estimate tokens for
 * @returns Total estimated token count
 */
export declare const estimateTokenCountFromMessages: (messages: Anthropic.Messages.MessageParam[]) => number;
