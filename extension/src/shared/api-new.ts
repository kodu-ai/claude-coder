export type ApiProvider = "anthropic"

export interface ApiHandlerOptions {
	koduApiKey?: string
	koduEmail?: string
	apiModelId?: KoduModelId
	browserModelId?: string
	cheapModelId?: string
}

export type ApiConfiguration = ApiHandlerOptions & {
	apiProvider?: ApiProvider
}

// Models

export interface ModelInfo {
	maxTokens: number
	contextWindow: number
	supportsImages: boolean
	supportsPromptCache: boolean
	disabld?: boolean
	capabilities?: {
		vision: boolean
		reasoning: boolean
		coding: boolean
	}
	isRecommended?: boolean
	label: string
	description: string
	category: string
	pricePerToken: number
}

export type ApiModelId = KoduModelId

// Anthropic
// https://docs.anthropic.com/en/docs/about-claude/models
export type AnthropicModelId = keyof typeof anthropicModels
export const anthropicDefaultModelId: AnthropicModelId = "claude-3-5-sonnet-20241022"
export const anthropicModels: Record<string, ModelInfo> = {
	"claude-3-5-sonnet-20241022": {
		maxTokens: 8192,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		pricePerToken: 0.000003,
		label: "Claude 3.5 Sonnet (New)",
		description: "Best model for code generation for the price",
		category: "Anthropic",
		capabilities: {
			coding: true,
			vision: true,
			reasoning: false,
		},
	},
	"claude-3-5-sonnet-20240620": {
		maxTokens: 8192,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		pricePerToken: 0.000003,
		label: "Claude 3.5 Sonnet (Old)",
		description: "Best model for code generation for the price",
		category: "Anthropic",
	},
	"claude-3-opus-20240229": {
		maxTokens: 4096,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		pricePerToken: 0.000003,

		label: "Claude 3 Opus",
		category: "Anthropic",
		description: "Best model for code generation for the price",
	},
	"claude-3-haiku-20240307": {
		maxTokens: 4096,
		contextWindow: 200_000,
		supportsImages: true,
		pricePerToken: 0.000003,
		supportsPromptCache: true,
		label: "Claude 3 Haiku",
		description: "Best model for code generation for the price",
		category: "Anthropic",
	},
	"claude-3-5-haiku-20241022": {
		maxTokens: 8192,
		contextWindow: 200_000,
		pricePerToken: 0.000003,
		supportsImages: false,
		supportsPromptCache: true,

		label: "Claude 3.5 Haiku",
		description: "Best model for code generation for the price",
		category: "Anthropic",
	},
} as const

export type KoduModelId = string
export const koduDefaultModelId: KoduModelId = "claude-3-5-sonnet-20241022"
export const koduModels: Record<string, ModelInfo> = {
	...anthropicModels,
	// ...grokModels,
}
export type KoduModels = typeof koduModels

export const returnValidModelId = (modelId: string): KoduModelId => {
	if (modelId === "claude-3-5-sonnet-20240620") {
		return "claude-3-5-sonnet-20241022"
	}
	if (koduModels[modelId]) {
		return modelId
	}
	return koduDefaultModelId
}
