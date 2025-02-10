import { ClaudeAsk, ClaudeSay, ClaudeMessage, V1ClaudeMessage } from "../../../shared/messages/extension-message";
import { ClaudeAskResponse } from "../../../shared/messages/client-message";
import { StateManager } from "../state-manager";
import { ExtensionProvider } from "../../../providers/extension-provider";
import { ChatTool } from "../../../shared/new-tools";
import { AskManager } from "./ask-manager";
import { DeepPartial } from "ai";
export declare enum TaskState {
    IDLE = "IDLE",
    WAITING_FOR_API = "WAITING_FOR_API",
    PROCESSING_RESPONSE = "PROCESSING_RESPONSE",
    EXECUTING_TOOL = "EXECUTING_TOOL",
    WAITING_FOR_USER = "WAITING_FOR_USER",
    COMPLETED = "COMPLETED",
    ABORTED = "ABORTED"
}
export declare class TaskError extends Error {
    type: "API_ERROR" | "TOOL_ERROR" | "USER_ABORT" | "UNKNOWN_ERROR" | "UNAUTHORIZED" | "PAYMENT_REQUIRED" | "NETWORK_ERROR";
    constructor({ type, message, }: {
        type: "API_ERROR" | "TOOL_ERROR" | "USER_ABORT" | "UNKNOWN_ERROR" | "UNAUTHORIZED" | "PAYMENT_REQUIRED" | "NETWORK_ERROR";
        message: string;
    });
}
export interface AskResponse {
    response: ClaudeAskResponse;
    text?: string;
    images?: string[];
}
export type AskDetails = {
    question?: string;
    tool?: ChatTool;
};
export declare abstract class TaskExecutorUtils {
    protected stateManager: StateManager;
    protected providerRef: WeakRef<ExtensionProvider>;
    askManager: AskManager;
    constructor(stateManager: StateManager, providerRef: WeakRef<ExtensionProvider>);
    handleAskResponse(response: ClaudeAskResponse, text?: string, images?: string[]): Promise<void>;
    ask(...args: Parameters<AskManager["ask"]>): Promise<AskResponse>;
    partialUpdateTool(data: Partial<ChatTool>, askTs: number): Promise<void>;
    updateAsk(type: ClaudeAsk, data: AskDetails, askTs: number): Promise<void>;
    updateSayPartial(sayTs: number, data: DeepPartial<ClaudeMessage>): Promise<void>;
    sayWithId(sayTs: number, type: ClaudeSay, text?: string, images?: string[], overrides?: Partial<ClaudeMessage>): Promise<number>;
    sayHook({ hookName, state, ts, output, input, apiMetrics, ...rest }: {
        hookName: string;
        state: "pending" | "completed" | "error";
        ts: number;
        output: string;
        input: string;
        apiMetrics?: V1ClaudeMessage["apiMetrics"];
    } & Partial<V1ClaudeMessage>): Promise<number>;
    say(type: ClaudeSay, text?: string, images?: string[], sayTs?: number, options?: Partial<V1ClaudeMessage>): Promise<number>;
    private getModelId;
    protected logState(message: string): void;
    protected logError(error: Error): void;
    protected abstract getState(): TaskState;
}
