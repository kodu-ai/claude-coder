import { Anthropic } from "@anthropic-ai/sdk";
import { ClaudeMessage } from "../../shared/messages/extension-message";
import "../../utils/path-helpers";
declare global {
    interface String {
        toPosix(): string;
    }
}
export declare const getCwd: () => string;
export declare const cwd: string;
/**
 * Get a readable path for display purposes
 * @param relPath - The relative path to convert
 * @param customCwd - Custom current working directory (optional)
 * @returns A readable path string
 */
export declare function getReadablePath(relPath: string, customCwd?: string): string;
/**
 * Format a list of files for display
 * @param absolutePath - The absolute path of the directory
 * @param files - Array of file paths
 * @returns Formatted string of file list
 */
export declare function formatFilesList(absolutePath: string, files: string[], didHitLimit: boolean): string;
/**
 * Format images into Anthropic image blocks
 * @param images - Array of image data URLs
 * @returns Array of Anthropic image blocks
 */
export declare function formatImagesIntoBlocks(images?: string[]): Anthropic.ImageBlockParam[];
/**
 * Format a tool response
 * @param text - The text response
 * @param images - Optional array of image data URLs
 * @returns Formatted tool response
 */
export declare function formatToolResponse(text: string, images?: string[]): string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>;
/**
 * Format a tool response block of text
 * @param toolName - The tool name
 * @param params - The parameters
 * @returns <t
 */
export declare function formatToolResponseText(toolName: string, params: Record<string, string>): string;
/**
 * Format generic tool feedback
 * @param feedback - The feedback text
 * @returns Formatted feedback string
 */
export declare function formatGenericToolFeedback(feedback?: string): string;
/**
 * Create a tool message for Claude
 * @param tool - The tool name
 * @param path - The path (if applicable)
 * @param content - The content
 * @param customCwd - Custom current working directory (optional)
 * @returns Formatted tool message
 */
export declare function createToolMessage(tool: string, path: string, content: string, customCwd?: string): string;
export declare const isTextBlock: (block: any) => block is Anthropic.TextBlockParam;
export declare const isImageBlock: (block: any) => block is Anthropic.ImageBlockParam;
export declare function cleanUIMessages(messages: ClaudeMessage[], error?: Error): void;
