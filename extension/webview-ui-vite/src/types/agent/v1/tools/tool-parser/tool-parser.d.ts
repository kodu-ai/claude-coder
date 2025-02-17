import { z } from "zod";
type ToolSchema = {
    name: string;
    schema: z.ZodObject<any>;
};
type ToolUpdateCallback = (id: string, toolName: string, params: any, ts: number) => Promise<void>;
type ToolEndCallback = (id: string, toolName: string, params: any, ts: number) => Promise<void>;
type ToolErrorCallback = (id: string, toolName: string, error: Error, ts: number) => Promise<void>;
type ToolClosingErrorCallback = (error: Error) => Promise<void>;
interface ToolParserConstructor {
    onToolUpdate?: ToolUpdateCallback;
    onToolEnd?: ToolEndCallback;
    onToolError?: ToolErrorCallback;
    onToolClosingError?: ToolClosingErrorCallback;
}
export declare class ToolParser {
    private isMock;
    private toolSchemas;
    private currentContext;
    private buffer;
    private isInTag;
    private isInTool;
    private nonToolBuffer;
    /**
     * Character-based threshold for partial updates
     */
    private readonly UPDATE_THRESHOLD;
    /**
     * Time-based flush interval (in ms). Even if UPDATE_THRESHOLD
     * isn't met, we'll flush after this interval passes.
     */
    private readonly FLUSH_INTERVAL;
    /** Timestamp of the last partial update flush */
    private lastFlushTime;
    onToolUpdate?: ToolUpdateCallback;
    onToolEnd?: ToolEndCallback;
    onToolError?: ToolErrorCallback;
    onToolClosingError?: ToolClosingErrorCallback;
    constructor(toolSchemas: ToolSchema[], { onToolUpdate, onToolEnd, onToolError, onToolClosingError }: ToolParserConstructor, isMock?: boolean);
    get isInToolTag(): boolean;
    appendText(text: string): string;
    /**
     * Checks if enough time has passed since last flush to force an update,
     * even if we haven't hit the character-based threshold or a new tag.
     */
    private checkTimeBasedFlush;
    private processChar;
    private processNonToolChar;
    private processToolChar;
    private checkForToolStart;
    private handleBufferContent;
    private sendProgressUpdate;
    private handleTag;
    private handleOpeningTag;
    private handleClosingTag;
    private finalizeTool;
    endParsing(): void;
    reset(): void;
}
export default ToolParser;
