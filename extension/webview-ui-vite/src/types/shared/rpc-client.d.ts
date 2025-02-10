import { ProcedureInstance } from "../router/utils/procedure";
import { Router } from "../router/utils/router";
import { ExtensionContext } from "../router/utils/context";
/**
 * Basic transport: correlation-based request→response.
 */
export declare class WebviewTransport {
    private vscodeApi;
    private pending;
    constructor(vscodeApi: {
        postMessage(msg: any): void;
    });
    /**
     * Send an RPC request.
     * @param route The procedure name (e.g. 'renameTask')
     * @param input The data for that route
     */
    call<T = any>(route: string, input: unknown): Promise<T>;
    /**
     * The webview must pass incoming messages here, e.g.:
     *   window.addEventListener('message', e => transport.handleMessage(e.data));
     */
    handleMessage(msg: unknown): void;
}
/**
 * For each route key in TRouter, produce a function:
 *   (input: TInput) => Promise<TOutput>
 */
export type ClientForRouter<TRouter extends Router> = {
    [K in keyof TRouter]: TRouter[K] extends ProcedureInstance<any, infer TInput, infer TOutput> ? (input: TInput) => Promise<TOutput> : never;
};
/**
 * Create a typed client from a router *type only*
 * by using a Proxy under the hood. We do not need the actual router object.
 *
 * Usage:
 *   import type { AppRouter } from "../app-router";
 *   const client = createClientForRouter<AppRouter>(transport);
 *   const result = await client.renameTask({ taskId: "abc", newName: "Hello" });
 */
export declare function createClientForRouter<TRouter extends Router>(transport: WebviewTransport): ClientForRouter<TRouter>;
export declare const createAppClient: (transport: WebviewTransport) => ClientForRouter<{
    listModels: ProcedureInstance<ExtensionContext, {}, {
        models: (import("../api/providers/types").ModelInfo | {
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
    currentObserverModel: ProcedureInstance<ExtensionContext, {}, {
        model: import("../api/providers/types").ModelInfo;
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
            models: import("../api/providers/types").ModelInfo[];
        };
    }>;
    selectObserverModel: ProcedureInstance<ExtensionContext, {
        modelId: string;
        providerId: string;
    }, {
        success: boolean;
    }>;
    currentApiSettings: ProcedureInstance<ExtensionContext, {}, {
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
    currentModel: ProcedureInstance<ExtensionContext, {}, {
        modelId: string | undefined;
    }>;
    currentModelInfo: ProcedureInstance<ExtensionContext, {}, {
        model: import("../api/providers/types").ModelInfo;
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
            models: import("../api/providers/types").ModelInfo[];
        };
    }>;
    selectModel: ProcedureInstance<ExtensionContext, {
        modelId: string;
        providerId: string;
    }, {
        success: boolean;
    }>;
    listProviders: ProcedureInstance<ExtensionContext, {}, {
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
    getProvider: ProcedureInstance<ExtensionContext, {
        id: string;
    }, {
        provider: import("../api/providers/types").ProviderConfig | {
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
    createProvider: ProcedureInstance<ExtensionContext, {
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
    updateProvider: ProcedureInstance<ExtensionContext, {
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
    deleteProvider: ProcedureInstance<ExtensionContext, {
        id: string;
    }, {
        success: boolean;
    }>;
} & {
    toggleGitHandler: ProcedureInstance<ExtensionContext, {
        enabled: boolean;
    }, {
        success: boolean;
    }>;
} & {
    openFile: ProcedureInstance<ExtensionContext, {
        filePath: string;
    }, {
        readonly success: false;
    } | {
        readonly success: true;
    }>;
    renameTask: ProcedureInstance<ExtensionContext, {
        taskId: string;
        newName: string;
    }, {
        readonly success: true;
    }>;
    pauseTask: ProcedureInstance<ExtensionContext, {
        taskId: string;
    }, {
        readonly paused: true;
        readonly taskId: string;
    }>;
    restoreTaskFromDisk: ProcedureInstance<ExtensionContext, {}, {
        readonly success: true;
        readonly tasksToRestore: string[];
        readonly taskHistoryItem: import("./history-item").HistoryItem[];
    }>;
    markAsDone: ProcedureInstance<ExtensionContext, {
        taskId: string;
    }, {
        readonly success: true;
    }>;
    exportTaskFiles: ProcedureInstance<ExtensionContext, {
        taskId: string;
    }, unknown>;
} & {
    getObserverSettings: ProcedureInstance<ExtensionContext, {}, {
        observerSettings: {
            modelId: string;
            providerId: import("../api/providers/constants").ProviderId;
            observePullMessages: number;
            observeEveryXRequests: number;
            observePrompt?: string;
        } | undefined;
    }>;
    enableObserverAgent: ProcedureInstance<ExtensionContext, {
        enabled: boolean;
    }, {
        success: boolean;
    }>;
    updateObserverAgent: ProcedureInstance<ExtensionContext, {
        modelId?: string | undefined;
        observePullMessages?: number | undefined;
        observeEveryXRequests?: number | undefined;
        clearPrompt?: boolean | undefined;
    }, {
        success: boolean;
    }>;
    customizeObserverPrompt: ProcedureInstance<ExtensionContext, {}, {
        success: boolean;
    }>;
}>;
