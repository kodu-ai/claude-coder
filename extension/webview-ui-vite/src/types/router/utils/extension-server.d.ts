import * as vscode from "vscode";
import { ExtensionContext } from "./context";
import { Router } from "./router";
import { ClientForRouter } from "../../shared/rpc-client";
export declare class ExtensionServer {
    private vscodeWebview;
    private ctx;
    private pending;
    constructor(vscodeWebview: vscode.Webview, ctx: ExtensionContext);
    /**
     * Handling incoming messages from the webview:
     *
     * 1) parse with requestMessageSchema
     * 2) find the matching route in appRouter
     * 3) parse input with route.schema
     * 4) call route.use(...) with (ctx, input)
     * 5) respond with the correlation `id` plus `result` or `error`
     */
    private handleMessage;
    /**
     * Send a response back to the webview with correlation ID.
     */
    private sendResponse;
}
export declare function createServerClient<TRouter extends Router>(appRouter: TRouter, ctx: ExtensionContext): ClientForRouter<TRouter>;
/**
 * singleton that initalize createServerClient with appRouter and ExtensionContext
 */
export declare class ServerRPC {
    private ctx;
    private static instance;
    private constructor();
    static getInstance(ctx?: ExtensionContext): ServerRPC;
    getClient(): ClientForRouter<{
        listModels: import("./procedure").ProcedureInstance<ExtensionContext, {}, {
            models: (import("../../api/providers/types").ModelInfo | {
                name: string;
                id: string;
                supportsImages: boolean;
                supportsPromptCache: boolean;
                contextWindow: number;
                maxTokens: number;
                inputPrice: number;
                outputPrice: number;
                cacheReadsPrice: number | undefined;
                cacheWritesPrice: number | undefined;
                provider: "openai-compatible";
            })[];
        }>;
        currentObserverModel: import("./procedure").ProcedureInstance<ExtensionContext, {}, {
            model: import("../../api/providers/types").ModelInfo;
            providerData: {
                providerId: string;
                currentProvider: {
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
                models: import("../../api/providers/types").ModelInfo[];
            };
        }>;
        selectObserverModel: import("./procedure").ProcedureInstance<ExtensionContext, {
            modelId: string;
            providerId: string;
        }, {
            success: boolean;
        }>;
        currentApiSettings: import("./procedure").ProcedureInstance<ExtensionContext, {}, {
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
            models: import("../../api/providers/types").ModelInfo[];
            model: import("../../api/providers/types").ModelInfo;
        }>;
        currentModel: import("./procedure").ProcedureInstance<ExtensionContext, {}, {
            modelId: string | undefined;
        }>;
        currentModelInfo: import("./procedure").ProcedureInstance<ExtensionContext, {}, {
            model: import("../../api/providers/types").ModelInfo;
            providerData: {
                providerId: string;
                currentProvider: {
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
                models: import("../../api/providers/types").ModelInfo[];
            };
        }>;
        selectModel: import("./procedure").ProcedureInstance<ExtensionContext, {
            modelId: string;
            providerId: string;
        }, {
            success: boolean;
        }>;
        listProviders: import("./procedure").ProcedureInstance<ExtensionContext, {}, {
            providers: {
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
            }[];
        }>;
        getProvider: import("./procedure").ProcedureInstance<ExtensionContext, {
            id: string;
        }, {
            provider: import("../../api/providers/types").ProviderConfig | {
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
            } | undefined;
        }>;
        createProvider: import("./procedure").ProcedureInstance<ExtensionContext, {
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
        }, {
            provider: {
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
        }>;
        updateProvider: import("./procedure").ProcedureInstance<ExtensionContext, {
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
        }, {
            provider: {
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
        }>;
        deleteProvider: import("./procedure").ProcedureInstance<ExtensionContext, {
            id: string;
        }, {
            success: boolean;
        }>;
    } & {
        toggleGitHandler: import("./procedure").ProcedureInstance<ExtensionContext, {
            enabled: boolean;
        }, {
            success: boolean;
        }>;
    } & {
        openFile: import("./procedure").ProcedureInstance<ExtensionContext, {
            filePath: string;
        }, {
            readonly success: false;
        } | {
            readonly success: true;
        }>;
        renameTask: import("./procedure").ProcedureInstance<ExtensionContext, {
            taskId: string;
            newName: string;
        }, {
            readonly success: true;
        }>;
        pauseTask: import("./procedure").ProcedureInstance<ExtensionContext, {
            taskId: string;
        }, {
            readonly paused: true;
            readonly taskId: string;
        }>;
        restoreTaskFromDisk: import("./procedure").ProcedureInstance<ExtensionContext, {}, {
            readonly success: true;
            readonly tasksToRestore: string[];
            readonly taskHistoryItem: import("../../shared/history-item").HistoryItem[];
        }>;
        markAsDone: import("./procedure").ProcedureInstance<ExtensionContext, {
            taskId: string;
        }, {
            readonly success: true;
        }>;
        exportTaskFiles: import("./procedure").ProcedureInstance<ExtensionContext, {
            taskId: string;
        }, unknown>;
    } & {
        getObserverSettings: import("./procedure").ProcedureInstance<ExtensionContext, {}, {
            observerSettings: {
                modelId: string;
                providerId: import("../../api/providers/constants").ProviderId;
                observePullMessages: number;
                observeEveryXRequests: number;
                observePrompt?: string;
            } | undefined;
        }>;
        enableObserverAgent: import("./procedure").ProcedureInstance<ExtensionContext, {
            enabled: boolean;
        }, {
            success: boolean;
        }>;
        updateObserverAgent: import("./procedure").ProcedureInstance<ExtensionContext, {
            modelId?: string | undefined;
            observePullMessages?: number | undefined;
            observeEveryXRequests?: number | undefined;
            clearPrompt?: boolean | undefined;
        }, {
            success: boolean;
        }>;
        customizeObserverPrompt: import("./procedure").ProcedureInstance<ExtensionContext, {}, {
            success: boolean;
        }>;
    }>;
}
export declare const serverRPC: typeof ServerRPC.getInstance;
