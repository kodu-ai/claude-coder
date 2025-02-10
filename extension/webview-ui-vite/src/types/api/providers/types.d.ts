import { z } from "zod";
import { ProviderId } from "./constants";
export interface ModelInfo {
    id: string;
    name: string;
    contextWindow: number;
    maxTokens: number;
    supportsImages: boolean;
    inputPrice: number;
    outputPrice: number;
    cacheReadsPrice?: number;
    cacheWritesPrice?: number;
    supportsPromptCache?: boolean;
    isRecommended?: boolean;
    isThinkingModel?: boolean;
    reasoningEffort?: "low" | "medium" | "high";
    provider: ProviderId;
}
interface BaseProviderConfig {
    id: ProviderId;
    name: string;
    baseUrl: string;
    models: ModelInfo[];
    requiredFields: string[];
}
interface ProviderConfigWithCustomSchema {
    isProviderCustom: true;
    /**
     * we will load this directly from memory
     */
    providerCustomSchema: z.infer<typeof customProviderSchema>;
}
export type ProviderConfig = BaseProviderConfig | (BaseProviderConfig & ProviderConfigWithCustomSchema);
export type ProviderType = ProviderId;
interface BaseProviderSettings {
    providerId: ProviderType;
}
export interface GoogleGenAISettings extends BaseProviderSettings {
    providerId: "google-genai";
    apiKey: string;
    baseUrl?: string;
    headers?: Record<string, string>;
}
export interface GoogleVertexSettings extends BaseProviderSettings {
    providerId: "google-vertex";
    clientEmail: string;
    privateKey: string;
    project: string;
    location: string;
}
export interface AmazonBedrockSettings extends BaseProviderSettings {
    providerId: "amazon-bedrock";
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}
export interface OpenAISettings extends BaseProviderSettings {
    providerId: "openai";
    apiKey: string;
    baseUrl?: string;
}
export interface TogetherAISettings extends BaseProviderSettings {
    providerId: "together-ai";
    apiKey: string;
    baseUrl?: string;
}
export interface FireworksSettings extends BaseProviderSettings {
    providerId: "fireworks";
    apiKey: string;
    baseUrl?: string;
}
export interface DeepseekSettings extends BaseProviderSettings {
    providerId: "deepseek";
    apiKey: string;
    baseUrl?: string;
}
export interface DeepInfraSettings extends BaseProviderSettings {
    providerId: "deepinfra";
    apiKey: string;
    baseUrl?: string;
}
export interface OpenAICompatibleSettings extends BaseProviderSettings, ProviderCustomSchema {
    providerId: "openai-compatible";
}
export interface KoduSettings extends BaseProviderSettings {
    providerId: "kodu";
    apiKey: string;
}
export interface MistralSettings extends BaseProviderSettings {
    providerId: "mistral";
    apiKey: string;
}
export type ProviderSettings = KoduSettings | GoogleGenAISettings | GoogleVertexSettings | AmazonBedrockSettings | OpenAISettings | TogetherAISettings | FireworksSettings | DeepseekSettings | DeepInfraSettings | OpenAICompatibleSettings;
export interface ProviderWithModel {
    settings: ProviderSettings;
    model: ModelInfo;
}
export declare const customProviderSchema: z.ZodObject<{
    baseUrl: z.ZodString;
    modelId: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    supportImages: z.ZodBoolean;
    inputLimit: z.ZodString;
    outputLimit: z.ZodString;
    inputTokensPrice: z.ZodNumber;
    outputTokensPrice: z.ZodNumber;
    cacheReadsPrice: z.ZodOptional<z.ZodNumber>;
    cacheWritesPrice: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    baseUrl: string;
    modelId: string;
    supportImages: boolean;
    inputLimit: string;
    outputLimit: string;
    inputTokensPrice: number;
    outputTokensPrice: number;
    apiKey?: string | undefined;
    cacheReadsPrice?: number | undefined;
    cacheWritesPrice?: number | undefined;
}, {
    baseUrl: string;
    modelId: string;
    supportImages: boolean;
    inputLimit: string;
    outputLimit: string;
    inputTokensPrice: number;
    outputTokensPrice: number;
    apiKey?: string | undefined;
    cacheReadsPrice?: number | undefined;
    cacheWritesPrice?: number | undefined;
}>;
export type ProviderCustomSchema = z.infer<typeof customProviderSchema>;
export {};
