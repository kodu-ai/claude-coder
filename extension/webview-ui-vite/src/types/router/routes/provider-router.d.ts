import { GlobalState } from "../../providers/state/global-state-manager";
import { ProviderConfig } from "../../api/providers/types";
export declare function getProvider(id: string): Promise<{
    provider: ProviderConfig;
} | {
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
    } | undefined;
}>;
export declare function getModelProviderData(providerId: string): Promise<{
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
}>;
export declare function getCurrentApiSettings(): Promise<{
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
export declare function listProviders(): Promise<{
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
export declare function getCurrentModelInfo(apiConfig?: GlobalState["apiConfig"]): Promise<{
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
declare const providerRouter: {
    listModels: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {}, {
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
    currentObserverModel: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {}, {
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
    selectObserverModel: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        modelId: string;
        providerId: string;
    }, {
        success: boolean;
    }>;
    currentApiSettings: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {}, {
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
    currentModel: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {}, {
        modelId: string | undefined;
    }>;
    currentModelInfo: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {}, {
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
    selectModel: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        modelId: string;
        providerId: string;
    }, {
        success: boolean;
    }>;
    listProviders: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {}, {
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
    getProvider: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        id: string;
    }, {
        provider: ProviderConfig | {
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
    createProvider: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
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
    updateProvider: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
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
    deleteProvider: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        id: string;
    }, {
        success: boolean;
    }>;
};
export default providerRouter;
