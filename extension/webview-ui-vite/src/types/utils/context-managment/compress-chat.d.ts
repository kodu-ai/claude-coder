import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.mjs";
import { ApiHandler } from "../../api";
import { ToolName } from "../../agent/v1/tools/types";
type CommandListItem = {
    id: string;
    command: string;
    output: string;
};
export declare class CompressToolExecution {
    private threshold;
    private apiHandler;
    private commandList;
    constructor(apiHandler: ApiHandler, threshold?: number);
    addCommand: (id: string, command: string, output: string) => void;
    compressAll: () => Promise<CommandListItem[]>;
    compress: (command: string, output: string) => Promise<string>;
    private compressExecution;
}
export declare const compressedTools: ToolName[];
/**
 * Main function to compress tool outputs in a message array
 */
export declare const compressToolFromMsg: (msgs: MessageParam[], apiHandler: ApiHandler, executeCommandThreshold?: number) => Promise<MessageParam[]>;
export {};
