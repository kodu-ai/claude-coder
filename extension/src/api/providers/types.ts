import { z, ZodSchema } from "zod"
import { PROVIDER_IDS, ProviderId } from "./constants"

// types.ts
export interface ModelInfo {
	id: string
	name: string
	contextWindow: number
	maxTokens: number
	supportsImages: boolean
	inputPrice: number
	outputPrice: number
	cacheReadsPrice?: number
	cacheWritesPrice?: number
	supportsPromptCache?: boolean
	isRecommended?: boolean
	isThinkingModel?: boolean
	reasoningEffort?: "low" | "medium" | "high"
	provider: ProviderId
}

interface BaseProviderConfig {
	id: ProviderId
	name: string
	baseUrl: string
	models: ModelInfo[]
	requiredFields: string[]
}

interface ProviderConfigWithCustomSchema {
	isProviderCustom: true
	/**
	 * we will load this directly from memory
	 */
	providerCustomSchema: z.infer<typeof customProviderSchema>
}

export type ProviderConfig = BaseProviderConfig | (BaseProviderConfig & ProviderConfigWithCustomSchema)

export type ProviderType = ProviderId

interface BaseProviderSettings {
	providerId: ProviderType
	// modelId: string
}

// Provider-specific settings interfaces
export interface GoogleGenAISettings extends BaseProviderSettings {
	providerId: "google-genai"
	apiKey: string
	baseUrl?: string
	headers?: Record<string, string>
}

export interface GoogleVertexSettings extends BaseProviderSettings {
	providerId: "google-vertex"
	clientEmail: string
	privateKey: string
	project: string
	location: string
}

export interface AmazonBedrockSettings extends BaseProviderSettings {
	providerId: "amazon-bedrock"
	region: string
	accessKeyId: string
	secretAccessKey: string
	sessionToken?: string
}

export interface OpenAISettings extends BaseProviderSettings {
	providerId: "openai"
	apiKey: string
	baseUrl?: string
}

export interface TogetherAISettings extends BaseProviderSettings {
	providerId: "together-ai"
	apiKey: string
	baseUrl?: string
}

export interface FireworksSettings extends BaseProviderSettings {
	providerId: "fireworks"
	apiKey: string
	baseUrl?: string
}

export interface DeepseekSettings extends BaseProviderSettings {
	providerId: "deepseek"
	apiKey: string
	baseUrl?: string
}

export interface DeepInfraSettings extends BaseProviderSettings {
	providerId: "deepinfra"
	apiKey: string
	baseUrl?: string
}

export interface OpenAICompatibleSettings extends BaseProviderSettings, ProviderCustomSchema {
	providerId: "openai-compatible"
	// ...ProviderCustomSchema
}

export interface KoduSettings extends BaseProviderSettings {
	providerId: "kodu"
	apiKey: string
}

export interface MistralSettings extends BaseProviderSettings {
	providerId: "mistral"
	apiKey: string
}

export type ProviderSettings =
	| KoduSettings
	| GoogleGenAISettings
	| GoogleVertexSettings
	| AmazonBedrockSettings
	| OpenAISettings
	| TogetherAISettings
	| FireworksSettings
	| DeepseekSettings
	| DeepInfraSettings
	| OpenAICompatibleSettings

export interface ProviderWithModel {
	settings: ProviderSettings
	model: ModelInfo
}

export const customProviderSchema = z.object({
	baseUrl: z.string(),
	modelId: z.string(),
	apiKey: z.string().optional(),
	supportImages: z.boolean(),
	inputLimit: z.string(),
	outputLimit: z.string(),
	inputTokensPrice: z.number(),
	outputTokensPrice: z.number(),
	cacheReadsPrice: z.number().optional(),
	cacheWritesPrice: z.number().optional(),
})

export type ProviderCustomSchema = z.infer<typeof customProviderSchema>
