import { ApiModelId } from "@/singletons/kodu-api/kodu-api-models"

export type ModelProvider = "anthropic" | "openrouter" | "bedrock" | "vertex"

export interface ApiClientOptions {
	koduApiKey?: string
	koduEmail?: string
	apiModelId?: ApiModelId
	apiKey?: string // anthropic
	openRouterApiKey?: string
	awsAccessKey?: string
	awsSecretKey?: string
	awsRegion?: string
	vertexProjectId?: string
	vertexRegion?: string
}

export type ApiClientConfiguration = ApiClientOptions & {
	apiProvider?: ModelProvider
	koduApiKey?: string
	apiModelId?: ApiModelId
}
