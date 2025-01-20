// providers/mistral.ts
import { ProviderConfig } from "../types"
import { DEFAULT_BASE_URLS, PROVIDER_IDS, PROVIDER_NAMES } from "../constants"

export const mistralConfig: ProviderConfig = {
	id: PROVIDER_IDS.MISTRAL,
	name: PROVIDER_NAMES[PROVIDER_IDS.MISTRAL],
	baseUrl: DEFAULT_BASE_URLS[PROVIDER_IDS.MISTRAL],
	models: [
		{
			id: "codestral-latest",
			name: "Codestral",
			contextWindow: 256_000 - 8192,
			maxTokens: 8192,
			supportsImages: false,
			inputPrice: 0.3,
			outputPrice: 0.9,
			supportsPromptCache: false,
			provider: PROVIDER_IDS.MISTRAL,
		},
	],
	requiredFields: ["apiKey"],
}
