// providers/google-genai.ts
import { ProviderConfig } from "../types"
import { DEFAULT_BASE_URLS, PROVIDER_IDS, PROVIDER_NAMES } from "../constants"

export const googleGenAIConfig: ProviderConfig = {
	id: PROVIDER_IDS.GOOGLE_GENAI,
	name: PROVIDER_NAMES[PROVIDER_IDS.GOOGLE_GENAI],
	baseUrl: DEFAULT_BASE_URLS[PROVIDER_IDS.GOOGLE_GENAI],
	models: [
		{
			id: "gemini-2.0-flash",
			name: "Gemini 2 Flash Official (AI Studio)",
			contextWindow: 1_048_576,
			maxTokens: 8192,
			supportsImages: true,
			inputPrice: 0.1,
			outputPrice: 0.4,
			// cacheReadsPrice: 0, // free for now
			// cacheWritesPrice: 0, // free for now
			supportsPromptCache: false,
			provider: PROVIDER_IDS.GOOGLE_GENAI,
		},
		{
			id: "gemini-2.0-flash-lite-preview-02-05",
			name: "Gemini 2 Flash Lite (AI Studio)",
			contextWindow: 1_048_576,
			maxTokens: 8192,
			supportsImages: true,
			inputPrice: 0.0, // free for now
			outputPrice: 0.0, // free for now
			// cacheReadsPrice: 0, // free for now
			// cacheWritesPrice: 0, // free for now
			supportsPromptCache: false,
			provider: PROVIDER_IDS.GOOGLE_GENAI,
		},
		{
			id: "gemini-2.0-pro-exp-02-05",
			name: "Gemini 2 Pro (AI Studio)",
			contextWindow: 2_097_152,
			maxTokens: 8192,
			supportsImages: true,
			inputPrice: 0, // free for now
			outputPrice: 0, // free for now
			cacheReadsPrice: 0, // free for now
			cacheWritesPrice: 0, // free for now
			supportsPromptCache: false,
			provider: PROVIDER_IDS.GOOGLE_GENAI,
		},
		{
			id: "gemini-2.0-flash-thinking-exp-01-21",
			name: "Gemini 2 Flash (AI Studio)",
			contextWindow: 1_048_576,
			maxTokens: 8192,
			supportsImages: true,
			inputPrice: 0, // free for now
			outputPrice: 0, // free for now
			cacheReadsPrice: 0, // free for now
			cacheWritesPrice: 0, // free for now
			supportsPromptCache: false,
			isThinkingModel: true,
			provider: PROVIDER_IDS.GOOGLE_GENAI,
		},
	],
	requiredFields: ["apiKey"],
}
