import { ImageBlockParam, TextBlock, TextBlockParam } from "@anthropic-ai/sdk/resources/messages.mjs";
import type { ToolResponseV2 } from "../agent/v1/types";
export type ContentBlock = TextBlock | ImageBlockParam | TextBlockParam;
export declare const isTextBlock: (block: any) => block is TextBlock;
export declare const isToolResponseV2: (result: any) => result is ToolResponseV2;
export declare const toolResponseToAIState: (result: ToolResponseV2, isCompressed?: boolean) => ContentBlock[];
export declare function getBase64ImageType(base64String: string): ImageBlockParam["source"]["media_type"] | null;
interface ToolResponse {
    toolName: string;
    toolStatus: string;
    toolResult: string;
    hasImages?: boolean;
}
/**
 * Parses XML string containing tool response into a structured object
 * @param xmlString The XML string to parse
 * @returns Parsed ToolResponse object
 * @throws Error if XML is invalid or required fields are missing
 */
export declare function parseToolResponse(xmlString: string): ToolResponse;
export {};
