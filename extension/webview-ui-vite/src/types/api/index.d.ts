import type { Anthropic } from "@anthropic-ai/sdk";
import { koduSSEResponse } from "../shared/kodu";
import { ApiHistoryItem } from "../agent/v1/main-agent";
import { ProviderId } from "./providers/constants";
import { ModelInfo, ProviderConfig } from "./providers/types";
import { z } from "zod";
export interface ApiHandlerMessageResponse {
    message: Anthropic.Messages.Message | Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage;
    userCredits?: number;
    errorString?: string;
    errorCode?: number;
}
export type ApiConfiguration = {
    providerId: ProviderId;
    modelId: string;
    koduApiKey: string;
};
export type ApiHandlerOptions = Omit<ProviderConfig, "models"> & {
    model: ProviderConfig["models"][number];
};
export type ApiConstructorOptions = {
    providerSettings: ProviderSettings;
    models: ProviderConfig["models"];
    model: ProviderConfig["models"][number];
};
export interface ApiHandler {
    createMessageStream({ systemPrompt, messages, abortSignal, top_p, tempature, modelId, appendAfterCacheToLastMessage, updateAfterCacheInserts, }: {
        systemPrompt: string[];
        messages: ApiHistoryItem[];
        abortSignal: AbortSignal | null;
        top_p?: number;
        tempature?: number;
        modelId: string;
        appendAfterCacheToLastMessage?: (lastMessage: Anthropic.Messages.Message) => void;
        updateAfterCacheInserts?: (messages: ApiHistoryItem[], systemMessages: Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam[]) => Promise<[ApiHistoryItem[], Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam[]]>;
    }): AsyncIterableIterator<koduSSEResponse>;
    get options(): ApiConstructorOptions;
    getModel(): {
        id: string;
        info: ModelInfo;
    };
}
export declare function buildApiHandler(configuration: ApiConstructorOptions): ApiHandler;
export declare function withoutImageData(userContent: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam>): Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam>;
export declare const providerSettingsSchema: z.ZodObject<z.objectUtil.extendShape<{
    providerId: z.ZodNativeEnum<{
        readonly KODU: "kodu";
        readonly GOOGLE_GENAI: "google-genai";
        readonly GOOGLE_VERTEX: "google-vertex";
        readonly AMAZON_BEDROCK: "amazon-bedrock";
        readonly OPENAI: "openai";
        readonly TOGETHER_AI: "together-ai";
        readonly FIREWORKS: "fireworks";
        readonly DEEPSEEK: "deepseek";
        readonly DEEPINFRA: "deepinfra";
        readonly MISTRAL: "mistral";
        readonly OPENAICOMPATIBLE: "openai-compatible";
    }>;
    modelId: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodOptional<z.ZodString>;
    clientEmail: z.ZodOptional<z.ZodString>;
    privateKey: z.ZodOptional<z.ZodString>;
    project: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    accessKeyId: z.ZodOptional<z.ZodString>;
    secretAccessKey: z.ZodOptional<z.ZodString>;
    sessionToken: z.ZodOptional<z.ZodString>;
}, {
    baseUrl: z.ZodOptional<z.ZodString>;
    modelId: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    supportImages: z.ZodOptional<z.ZodBoolean>;
    inputLimit: z.ZodOptional<z.ZodString>;
    outputLimit: z.ZodOptional<z.ZodString>;
    inputTokensPrice: z.ZodOptional<z.ZodNumber>;
    outputTokensPrice: z.ZodOptional<z.ZodNumber>;
    cacheReadsPrice: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    cacheWritesPrice: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}>, "strip", z.ZodTypeAny, {
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
}>;
export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
