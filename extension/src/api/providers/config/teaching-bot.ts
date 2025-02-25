import { ProviderConfig } from "../types"

export const teachingBotConfig: ProviderConfig = {
    id: "teaching-bot" as const,
    name: "Teaching Bot",
    baseUrl: "https://api.anthropic.com/v1",
    models: [
        {
            id: "claude-3-teaching",
            name: "Claude Teaching Assistant",
            contextWindow: 128000,
            maxTokens: 4096,
            supportsImages: true,
            inputPrice: 0.5,
            outputPrice: 1.5,
            provider: "teaching-bot"
        }
    ],
    requiredFields: ["apiKey"]
}