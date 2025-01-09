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
	provider: ProviderId
}

export interface ProviderConfig {
	id: string
	name: string
	baseUrl: string
	models: ModelInfo[]
	requiredFields: string[]
}

export type ProviderType = ProviderId

interface BaseProviderSettings {
	providerId: ProviderType
	modelId: string
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

export interface CustomSettings extends BaseProviderSettings {
	providerId: "custom"
	baseUrl: string
	apiKey: string
	name: string
	supportImages: boolean
	inputLimit: string
	outputLimit: string
}

export interface KoduSettings extends BaseProviderSettings {
	providerId: "kodu"
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
	| CustomSettings

export interface ProviderWithModel {
	settings: ProviderSettings
	model: ModelInfo
}
