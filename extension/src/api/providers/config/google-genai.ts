// providers/google-genai.ts
import { ProviderConfig } from "../types"
import { DEFAULT_BASE_URLS, PROVIDER_IDS } from "../constants"

export const googleGenAIConfig: ProviderConfig = {
	id: PROVIDER_IDS.GOOGLE_GENAI,
	name: "Google AI Studio",
	baseUrl: DEFAULT_BASE_URLS[PROVIDER_IDS.GOOGLE_GENAI],
	models: [
		{
			id: "gemini-2.0-flash-exp",
			name: "Gemini 2 Flash (AI Studio)",
			contextWindow: 1_048_576,
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
			id: "gemini-2.0-flash-thinking-exp-1219",
			name: "Gemini 2 Flash Thinking (AI Studio)",
			contextWindow: 32_767,
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
			id: "gemini-exp-1206",
			name: "Gemini Exp 1206 (AI Studio)",
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
	],
	requiredFields: ["apiKey"],
}
