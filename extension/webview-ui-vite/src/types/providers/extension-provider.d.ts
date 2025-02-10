import * as vscode from "vscode";
import { MainAgent } from "../agent/v1/main-agent";
import { ExtensionStateManager } from "./state/extension-state-manager";
import { WebviewManager } from "./webview/webview-manager";
import { TaskManager } from "./state/task-manager";
import { GlobalStateManager } from "./state/global-state-manager";
import { ApiManager } from "./state/api-manager";
import { HistoryItem } from "../shared/history-item";
import { SecretStateManager } from "./state/secret-state-manager";
import { ApiConfiguration } from "../api";
export declare class ExtensionProvider implements vscode.WebviewViewProvider {
    readonly context: vscode.ExtensionContext;
    private readonly outputChannel;
    static readonly sideBarId: string;
    static readonly tabPanelId: string;
    private disposables;
    private view?;
    private _koduDev?;
    get koduDev(): MainAgent | undefined;
    set koduDev(value: MainAgent | undefined);
    private stateManager;
    private webviewManager;
    private secretStateManager;
    private taskManager;
    private globalStateManager;
    private apiManager;
    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel);
    dispose(): Promise<void>;
    resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): void | Thenable<void>;
    initWithTask(task?: string, images?: string[], isDebug?: boolean): Promise<void>;
    initWithHistoryItem(historyItem: HistoryItem): Promise<void>;
    /**
     * useful to initialize the provider without a task (e.g. when the user opens the extension for the first time and you want to test some functionality)
     */
    initWithNoTask(): Promise<void>;
    getCurrentApiSettings(): Promise<{
        providerSettings: {
            providerId: "kodu" | "google-genai" | "google-vertex" | "amazon-bedrock" | "openai" | "together-ai" | "fireworks" | "deepseek" | "deepinfra" | "mistral" | "openai-compatible";
            apiKey?: string | undefined;
            region?: string | undefined;
            baseUrl?: string | undefined;
            modelId?: string | undefined;
            supportImages?: boolean | undefined;
            inputLimit?: string | undefined;
            outputLimit?: string | undefined;
            inputTokensPrice?: number | undefined;
            outputTokensPrice?: number | undefined;
            cacheReadsPrice?: number | undefined;
            cacheWritesPrice?: number | undefined;
            clientEmail?: string | undefined;
            privateKey?: string | undefined;
            project?: string | undefined;
            location?: string | undefined;
            accessKeyId?: string | undefined;
            secretAccessKey?: string | undefined;
            sessionToken?: string | undefined;
        };
        models: import("../api/providers/types").ModelInfo[];
        model: import("../api/providers/types").ModelInfo;
    }>;
    getKoduDev(): MainAgent | undefined;
    getStateManager(): ExtensionStateManager;
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
        claudeMessages: import("../shared/messages/extension-message").V1ClaudeMessage[];
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
            providerId: import("../api/providers/constants").ProviderId;
            observePullMessages: number;
            observeEveryXRequests: number;
            observePrompt?: string;
        } | undefined;
        apiConfig: Partial<ApiConfiguration> | undefined;
        gitCommitterType: "kodu" | "user" | undefined;
    }>;
    getWebviewManager(): WebviewManager;
    getTaskManager(): TaskManager;
    getSecretStateManager(): SecretStateManager;
    getGlobalStateManager(): GlobalStateManager;
    getApiManager(): ApiManager;
    getContext(): vscode.ExtensionContext;
    getOutputChannel(): vscode.OutputChannel;
}
