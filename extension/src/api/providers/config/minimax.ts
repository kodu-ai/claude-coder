// providers/minimax.ts
import { ProviderConfig } from "../types"
import { PROVIDER_IDS, PROVIDER_NAMES } from "../constants"

// Regional OpenAI-compatible base URLs. The global endpoint is the default;
// the CN endpoint is supported for users in mainland China.
export const MINIMAX_BASE_URL_GLOBAL = "https://api.minimax.io/v1"
export const MINIMAX_BASE_URL_CN = "https://api.minimaxi.com/v1"

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
			supportsPromptCache: true,
			inputPrice: 0.6,
			outputPrice: 2.4,
			cacheReadsPrice: 0.12,
			isThinkingModel: true,
			provider: PROVIDER_IDS.MINIMAX,
		},
		{
			id: "MiniMax-M2.7",
			name: "MiniMax M2.7",
			contextWindow: 204_800,
			maxTokens: 204_800,
			supportsImages: false,
			supportsPromptCache: true,
			inputPrice: 0.3,
			outputPrice: 1.2,
			cacheReadsPrice: 0.06,
			cacheWritesPrice: 0.375,
			isThinkingModel: true,
			provider: PROVIDER_IDS.MINIMAX,
		},
	],
	requiredFields: ["apiKey"],
}
