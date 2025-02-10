import * as vscode from "vscode";
import { HistoryItem } from "../../shared/history-item";
import { ToolName } from "../../agent/v1/tools/types";
import { ProviderId } from "../../api/providers/constants";
import { ApiConfiguration } from "../../api";
type User = {
    email: string;
    credits: number;
    id: string;
    isVisitor: boolean;
};
export type GlobalState = {
    user: User | undefined | null;
    terminalCompressionThreshold: number | undefined;
    lastShownAnnouncementId: string | undefined;
    customInstructions: string | undefined;
    apiConfig?: Partial<ApiConfiguration>;
    gitHandlerEnabled: boolean | undefined;
    gitCommitterType: "kodu" | "user" | undefined;
    readFileMaxLines: number | undefined;
    alwaysAllowReadOnly: boolean | undefined;
    alwaysAllowWriteOnly: boolean | undefined;
    inlineEditOutputType?: "full" | "diff";
    autoSummarize: boolean | undefined;
    taskHistory: HistoryItem[] | undefined;
    autoCloseTerminal: boolean | undefined;
    skipWriteAnimation: boolean | undefined;
    commandTimeout: number | undefined;
    activePromptName: string | undefined;
    observerSettings: {
        /**
         * The model ID to use for the observer
         */
        modelId: string;
        /**
         * The provider ID that is associated with the model
         */
        providerId: ProviderId;
        /**
         * The number of last messages to pull to the observer for observation
         */
        observePullMessages: number;
        /**
         * The number of requests to make before triggering the observer
         */
        observeEveryXRequests: number;
        /**
         * Custom prompt to use for the observer
         */
        observePrompt?: string;
    } | undefined;
    disabledTools: ToolName[] | undefined;
    isMigratedTaskCompleted: boolean | undefined;
};
export declare class GlobalStateManager {
    private static instance;
    private context;
    private constructor();
    static getInstance(context?: vscode.ExtensionContext): GlobalStateManager;
    updatePartialGlobalState<K extends keyof GlobalState>(key: K, value: Partial<GlobalState[K]>): Promise<void>;
    updateGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]): Promise<void>;
    getGlobalState<K extends keyof GlobalState>(key: K): GlobalState[K];
    resetState(): Promise<void>;
    private getKeyDefaultValue;
}
export {};
