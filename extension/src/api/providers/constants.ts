// constants.ts
export const PROVIDER_IDS = {
	KODU: "kodu",
	GOOGLE_GENAI: "google-genai",
	GOOGLE_VERTEX: "google-vertex",
	AMAZON_BEDROCK: "amazon-bedrock",
	OPENAI: "openai",
	TOGETHER_AI: "together-ai",
	FIREWORKS: "fireworks",
	DEEPSEEK: "deepseek",
	DEEPINFRA: "deepinfra",
	MISTRAL: "mistral",
	OPENAICOMPATIBLE: "openai-compatible",
} as const

export const PROVIDER_NAMES = {
	[PROVIDER_IDS.KODU]: "Kodu",
	[PROVIDER_IDS.GOOGLE_GENAI]: "Google AI Studio",
	[PROVIDER_IDS.GOOGLE_VERTEX]: "Google Vertex AI",
	[PROVIDER_IDS.AMAZON_BEDROCK]: "Amazon Bedrock",
	[PROVIDER_IDS.OPENAI]: "OpenAI",
	[PROVIDER_IDS.MISTRAL]: "Mistral",
	[PROVIDER_IDS.TOGETHER_AI]: "Together.ai",
	[PROVIDER_IDS.FIREWORKS]: "Fireworks.ai",
	[PROVIDER_IDS.DEEPSEEK]: "DeepSeek",
	[PROVIDER_IDS.DEEPINFRA]: "DeepInfra",
	[PROVIDER_IDS.OPENAICOMPATIBLE]: "OpenAI Compatible",
} as const

export const DEFAULT_BASE_URLS = {
	[PROVIDER_IDS.KODU]: "https://www.kodu.ai/api/inference-stream",
	[PROVIDER_IDS.GOOGLE_GENAI]: "https://generativelanguage.googleapis.com/v1beta",
	[PROVIDER_IDS.OPENAI]: "https://api.openai.com/v1",
	[PROVIDER_IDS.TOGETHER_AI]: "https://api.together.xyz/v1",
	[PROVIDER_IDS.FIREWORKS]: "https://api.fireworks.ai/inference/v1",
	[PROVIDER_IDS.DEEPSEEK]: "https://api.deepseek.com/v1",
	[PROVIDER_IDS.DEEPINFRA]: "https://api.deepinfra.com/v1/openai",
	[PROVIDER_IDS.OPENAICOMPATIBLE]: "http://localhost:1234",
	[PROVIDER_IDS.MISTRAL]: "https://codestral.mistral.ai/v1",
} as const

// For type safety when using provider IDs
export type ProviderId = keyof typeof PROVIDER_NAMES

// // Helper function to check if a provider needs additional fields beyond apiKey
// // TODO: SWITCH TO LOAD IT FROM CONFIG
// export const getRequiredFields = (providerId: ProviderId): string[] => {
// 	switch (providerId) {
// 		case PROVIDER_IDS.GOOGLE_VERTEX:
// 			return ["clientEmail", "privateKey", "project", "location"]
// 		case PROVIDER_IDS.AMAZON_BEDROCK:
// 			return ["region", "accessKeyId", "secretAccessKey"]
// 		case PROVIDER_IDS.CUSTOM:
// 			return ["name", "baseUrl", "apiKey", "modelId", "inputLimit", "outputLimit"]
// 		default:
// 			return ["apiKey"]
// 	}
// }

// Helper to get the default base URL for a provider
export const getDefaultBaseUrl = (providerId: ProviderId): string | undefined => {
	return DEFAULT_BASE_URLS[providerId as keyof typeof DEFAULT_BASE_URLS]
}

// Helper to get provider name
export const getProviderName = (providerId: ProviderId): string => {
	return PROVIDER_NAMES[providerId] || "Unknown Provider"
}
