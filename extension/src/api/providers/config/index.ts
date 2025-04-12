// providers/index.ts
import { deepseekConfig } from "./deepseek"
import { openaiConfig } from "./openai"
import { koduConfig } from "./kodu"
import { PROVIDER_IDS } from "../constants"
import { ProviderConfig, ModelInfo } from "../types"
import { googleGenAIConfig } from "./google-genai"
import { openaiCompatible } from "./openai-compatible"
import { mistralConfig } from "./mistral"
import { anthropicConfig } from "./anthropic"
import { openRouterConfig } from "./openrouter"

export const providerConfigs: Record<string, ProviderConfig> = {
	[PROVIDER_IDS.KODU]: koduConfig,
	[PROVIDER_IDS.DEEPSEEK]: deepseekConfig,
	[PROVIDER_IDS.OPENAI]: openaiConfig,
	[PROVIDER_IDS.GOOGLE_GENAI]: googleGenAIConfig,
	[PROVIDER_IDS.OPENAICOMPATIBLE]: openaiCompatible,
	[PROVIDER_IDS.MISTRAL]: mistralConfig,
	[PROVIDER_IDS.ANTHROPIC]: anthropicConfig,
	[PROVIDER_IDS.OPENROUTER]: openRouterConfig,
	// Add other providers here as they're created
}

export const customProvidersConfigs: Record<string, ProviderConfig> = Object.fromEntries(
	Object.entries(providerConfigs).filter(([providerId]) => providerId !== PROVIDER_IDS.KODU)
)

export const models = Object.values(providerConfigs).flatMap((provider) => provider.models)

export type ProviderConfigs = typeof providerConfigs

// Uniwersalny adapter dostawców LLM
export const getProviderByModelId = (modelId: string): ProviderConfig | undefined => {
  // Znajdź dostawcę, który zawiera model o określonym ID
  return Object.values(providerConfigs).find(provider => 
    provider.models.some(model => model.id === modelId)
  );
}

// Funkcja do grupowania modeli według zdolności/możliwości
export const getModelsByCapabilities = (capability: string): ModelInfo[] => {
  return models.filter(model => {
    if (capability === 'vision' && model.supportsImages) return true;
    if (capability === 'function_calling' && model.supportsFunctionCalling) return true;
    if (capability === 'structured_output' && model.supportsStructuredOutput) return true;
    if (capability === 'sequential_thinking' && model.supportsSequentialThinking) return true;
    if (capability === 'search' && model.supportsSearch) return true;
    return false;
  });
}

// Funkcja do uzyskania zalecanych modeli (optymalizacja UX)
export const getRecommendedModels = (): ModelInfo[] => {
  return models.filter(model => model.isRecommended);
}
