import { ProviderConfig } from "../types"

import { PROVIDER_IDS, PROVIDER_NAMES } from "../constants"

export const teachingBotConfig: ProviderConfig = {
    id: PROVIDER_IDS.TEACHING_BOT,
    name: PROVIDER_NAMES[PROVIDER_IDS.TEACHING_BOT],
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
            provider: PROVIDER_IDS.TEACHING_BOT
        }
    ],
    requiredFields: ["apiKey"]
}