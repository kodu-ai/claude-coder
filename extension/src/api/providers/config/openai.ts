// providers/openai.ts
import { ProviderConfig } from "../types"
import { DEFAULT_BASE_URLS, PROVIDER_IDS } from "../constants"

export const openaiConfig: ProviderConfig = {
	id: PROVIDER_IDS.OPENAI,
	name: "OpenAI",
	baseUrl: DEFAULT_BASE_URLS[PROVIDER_IDS.OPENAI],
	models: [
		{
			id: "o1-preview",
			name: "O1 Preview",
			contextWindow: 128000,
			maxTokens: 32768,
			supportsImages: true,
			supportsPromptCache: true,
			inputPrice: 15.0,
			outputPrice: 60.0,
			cacheReadsPrice: 15.0 * 0.5, // 50% of input price
			provider: PROVIDER_IDS.OPENAI,
			cacheWritesPrice: 15.0,
		},
		{
			id: "o1-mini",
			name: "O1 Mini",
			contextWindow: 128000,
			maxTokens: 65536,
			supportsImages: true,
			supportsPromptCache: true,
			inputPrice: 3.0,
			outputPrice: 12.0,
			cacheReadsPrice: 3.0 * 0.5, // 50% of input price
			provider: PROVIDER_IDS.OPENAI,
			cacheWritesPrice: 3.0,
		},
		{
			id: "gpt-4o",
			name: "GPT-4 O",
			contextWindow: 128000,
			maxTokens: 4096,
			supportsImages: true,
			supportsPromptCache: true,
			inputPrice: 5.0,
			outputPrice: 15.0,
			cacheReadsPrice: 5.0 * 0.5, // 50% of input price
			provider: PROVIDER_IDS.OPENAI,
			cacheWritesPrice: 5.0,
		},
		{
			id: "gpt-4o-mini",
			name: "GPT-4 O Mini",
			contextWindow: 128000,
			maxTokens: 16384,
			supportsImages: true,
			supportsPromptCache: true,
			inputPrice: 0.15,
			outputPrice: 0.6,
			provider: PROVIDER_IDS.OPENAI,
			cacheWritesPrice: 0.15,
			cacheReadsPrice: 0.15 * 0.5, // 50% of input price
		},
	],
	requiredFields: ["apiKey"],
}
