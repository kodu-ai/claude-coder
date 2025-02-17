import { ExtensionContext } from "./utils/context";
export declare const appRouter: {
    listModels: import("./utils/procedure").ProcedureInstance<ExtensionContext, {}, {
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
    currentObserverModel: import("./utils/procedure").ProcedureInstance<ExtensionContext, {}, {
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
    selectObserverModel: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        modelId: string;
        providerId: string;
    }, {
        success: boolean;
    }>;
    currentApiSettings: import("./utils/procedure").ProcedureInstance<ExtensionContext, {}, {
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
    currentModel: import("./utils/procedure").ProcedureInstance<ExtensionContext, {}, {
        modelId: string | undefined;
    }>;
    currentModelInfo: import("./utils/procedure").ProcedureInstance<ExtensionContext, {}, {
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
    selectModel: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        modelId: string;
        providerId: string;
    }, {
        success: boolean;
    }>;
    listProviders: import("./utils/procedure").ProcedureInstance<ExtensionContext, {}, {
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
    getProvider: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
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
    createProvider: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
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
    updateProvider: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
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
    deleteProvider: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        id: string;
    }, {
        success: boolean;
    }>;
} & {
    toggleGitHandler: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        enabled: boolean;
    }, {
        success: boolean;
    }>;
} & {
    openFile: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        filePath: string;
    }, {
        readonly success: false;
    } | {
        readonly success: true;
    }>;
    renameTask: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        taskId: string;
        newName: string;
    }, {
        readonly success: true;
    }>;
    pauseTask: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        taskId: string;
    }, {
        readonly paused: true;
        readonly taskId: string;
    }>;
    restoreTaskFromDisk: import("./utils/procedure").ProcedureInstance<ExtensionContext, {}, {
        readonly success: true;
        readonly tasksToRestore: string[];
        readonly taskHistoryItem: import("../shared/history-item").HistoryItem[];
    }>;
    markAsDone: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        taskId: string;
    }, {
        readonly success: true;
    }>;
    exportTaskFiles: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        taskId: string;
    }, unknown>;
} & {
    getObserverSettings: import("./utils/procedure").ProcedureInstance<ExtensionContext, {}, {
        observerSettings: {
            modelId: string;
            providerId: import("../api/providers/constants").ProviderId;
            observePullMessages: number;
            observeEveryXRequests: number;
            observePrompt?: string;
        } | undefined;
    }>;
    enableObserverAgent: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        enabled: boolean;
    }, {
        success: boolean;
    }>;
    updateObserverAgent: import("./utils/procedure").ProcedureInstance<ExtensionContext, {
        modelId?: string | undefined;
        observePullMessages?: number | undefined;
        observeEveryXRequests?: number | undefined;
        clearPrompt?: boolean | undefined;
    }, {
        success: boolean;
    }>;
    customizeObserverPrompt: import("./utils/procedure").ProcedureInstance<ExtensionContext, {}, {
        success: boolean;
    }>;
};
export type AppRouter = typeof appRouter;
