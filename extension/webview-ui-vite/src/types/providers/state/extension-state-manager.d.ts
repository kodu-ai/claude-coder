import { HistoryItem } from "../../shared/history-item";
import { ExtensionProvider } from "../extension-provider";
import { V1ClaudeMessage } from "../../shared/messages/extension-message";
/**
 * this at the current form can't be a singleton because it has dependicies on the KoduDev instance, and one extension can have multiple KoduDev instances
 */
export declare class ExtensionStateManager {
    private context;
    private globalStateManager;
    private secretStateManager;
    constructor(context: ExtensionProvider);
    getState(): Promise<{
        user: {
            email: string;
            credits: number;
            id: string;
            isVisitor: boolean;
        } | null | undefined;
        terminalCompressionThreshold: number | undefined;
        lastShownAnnouncementId: string | undefined;
        customInstructions: string | undefined;
        commandTimeout: number;
        currentTaskId: string | undefined;
        alwaysAllowReadOnly: boolean;
        shouldShowAnnouncement: boolean;
        claudeMessages: V1ClaudeMessage[];
        version: any;
        alwaysAllowWriteOnly: boolean;
        taskHistory: HistoryItem[];
        autoCloseTerminal: boolean;
        skipWriteAnimation: boolean;
        currentContextWindow: number;
        currentContextTokens: number;
        autoSummarize: boolean;
        inlineEditOutputType: "full" | "diff";
        gitHandlerEnabled: boolean;
        observerSettings: {
            modelId: string;
            providerId: import("../../api/providers/constants").ProviderId;
            observePullMessages: number;
            observeEveryXRequests: number;
            observePrompt?: string;
        } | undefined;
        apiConfig: Partial<import("../../api").ApiConfiguration> | undefined;
        gitCommitterType: "kodu" | "user" | undefined;
    }>;
    clearHistory(): Promise<void>;
    setAutoCloseTerminal(value: boolean): Promise<void>;
    setTerminalCompressionThreshold(value: number | undefined): Promise<void>;
    setInlineEditModeType(value: "full" | "diff"): Promise<void>;
    updateTaskHistory(item: Partial<HistoryItem> & {
        id: string;
    }, metadata?: {
        lastMessageAt?: number;
    }): Promise<HistoryItem[]>;
    clearTaskHistory(): Promise<void>;
    fetchKoduUser(): Promise<{
        credits: number;
        id: string;
        email: string;
        isVisitor: boolean;
    } | null>;
    setSkipWriteAnimation(value: boolean): Promise<void>;
    updateKoduCredits(credits: number): Promise<void>;
    setCustomInstructions(value: string | undefined): Promise<void>;
    setAutoSummarize(value: boolean): Promise<void>;
    setGitHandlerEnabled(value: boolean): Promise<void>;
    setAlwaysAllowReadOnly(value: boolean): Promise<void>;
    setAlwaysAllowWriteOnly(value: boolean): Promise<void>;
}
