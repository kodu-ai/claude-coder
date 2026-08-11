// providers/minimax.ts
import { ProviderConfig } from "../types"
import { PROVIDER_IDS, PROVIDER_NAMES } from "../constants"

// Regional API-compatible base URLs. The global OpenAI endpoint is the default.
export const MINIMAX_BASE_URL_GLOBAL = "https://api.minimax.io/v1"
export const MINIMAX_BASE_URL_CN = "https://api.minimaxi.com/v1"
export const MINIMAX_ANTHROPIC_BASE_URL_GLOBAL = "https://api.minimax.io/anthropic"
export const MINIMAX_ANTHROPIC_BASE_URL_CN = "https://api.minimaxi.com/anthropic"

export const MINIMAX_ENDPOINTS = [
	{
		label: "Global (OpenAI-compatible)",
		baseUrl: MINIMAX_BASE_URL_GLOBAL,
		apiFormat: "openai",
	},
	{
		label: "China (OpenAI-compatible)",
		baseUrl: MINIMAX_BASE_URL_CN,
		apiFormat: "openai",
	},
	{
		label: "Global (Anthropic-compatible)",
		baseUrl: MINIMAX_ANTHROPIC_BASE_URL_GLOBAL,
		apiFormat: "anthropic",
	},
	{
		label: "China (Anthropic-compatible)",
		baseUrl: MINIMAX_ANTHROPIC_BASE_URL_CN,
		apiFormat: "anthropic",
	},
] as const

export const isMiniMaxAnthropicEndpoint = (baseUrl: string) => {
	const normalizedBaseUrl = baseUrl.replace(/\/+$/, "")
	return MINIMAX_ENDPOINTS.some(
		(endpoint) => endpoint.apiFormat === "anthropic" && endpoint.baseUrl === normalizedBaseUrl
	)
}

export const minimaxConfig: ProviderConfig = {
	id: PROVIDER_IDS.MINIMAX,
	name: PROVIDER_NAMES[PROVIDER_IDS.MINIMAX],
	baseUrl: MINIMAX_BASE_URL_GLOBAL,
	models: [
		{
			id: "MiniMax-M3",
			name: "MiniMax M3",
			contextWindow: 1_000_000,
			maxTokens: 1_000_000,
			supportsImages: true,
			inputModalities: ["text", "image", "video"],
			supportsPromptCache: true,
			inputPrice: 0.6,
			outputPrice: 2.4,
			cacheReadsPrice: 0.12,
			isThinkingModel: true,
			thinkingModes: ["adaptive", "disabled"],
			provider: PROVIDER_IDS.MINIMAX,
		},
		{
			id: "MiniMax-M2.7",
			name: "MiniMax M2.7",
			contextWindow: 204_800,
			maxTokens: 204_800,
			supportsImages: false,
			inputModalities: ["text"],
			supportsPromptCache: true,
			inputPrice: 0.3,
			outputPrice: 1.2,
			cacheReadsPrice: 0.06,
			cacheWritesPrice: 0.375,
			isThinkingModel: true,
			thinkingModes: ["always_on"],
			provider: PROVIDER_IDS.MINIMAX,
		},
	],
	requiredFields: ["apiKey"],
}
