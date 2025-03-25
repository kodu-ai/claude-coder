// Enhanced OpenRouter provider support
import axios from "axios"
import { ModelInfo } from "../types"
import { PROVIDER_IDS } from "../constants"

/**
 * Extract provider name from model ID
 */
export function extractProviderFromModelId(modelId: string): string {
  // Model ID format is usually "provider/model-name"
  return modelId.split('/')[0] || 'unknown';
}

/**
 * Transform OpenRouter model data with enhanced metadata
 */
export function transformOpenRouterModel(model: any): ModelInfo {
  // Parse pricing data if available
  const inputPrice = model.pricing?.prompt ? parseFloat(model.pricing.prompt) * 1000000 : 5
  const outputPrice = model.pricing?.completion ? parseFloat(model.pricing.completion) * 1000000 : 15

  // Extract provider info from model ID
  const providerName = extractProviderFromModelId(model.id);
  
  // Base model info
  const modelInfo: ModelInfo = {
    id: model.id,
    name: model.name || model.id,
    contextWindow: model.context_length || 8192,
    maxTokens: model.top_provider?.max_completion_tokens || 4096,
    supportsImages: model.architecture?.modality?.includes("image") || false,
    inputPrice,
    outputPrice,
    supportsPromptCache: false,
    provider: PROVIDER_IDS.OPENROUTER,
    providerName, // New field for provider identification
    supportsSequentialThinking: false, // Default value
  }

  // Configure provider-specific capabilities
  switch(providerName.toLowerCase()) {
    case "anthropic":
      modelInfo.supportsPromptCache = true;
      modelInfo.cacheWritesPrice = inputPrice * 1.25;
      modelInfo.cacheReadsPrice = inputPrice * 0.1;
      modelInfo.supportsSequentialThinking = true;
      modelInfo.isRecommended = true;
      break;
    case "openai":
      modelInfo.supportsFunctionCalling = true;
      modelInfo.supportsStructuredOutput = true; 
      modelInfo.supportsSequentialThinking = true;
      break;
    case "meta":
      // Llama models capabilities
      break;
    case "mistral":
      modelInfo.supportsFunctionCalling = true;
      break;
    case "cohere":
      modelInfo.supportsSearch = true;
      break;
    case "deepseek":
      modelInfo.supportsPromptCache = true;
      modelInfo.cacheWritesPrice = 0.14;
      modelInfo.cacheReadsPrice = 0.014;
      break;
  }
  
  return modelInfo;
}

/**
 * Group models by provider for better UI organization
 */
export function groupModelsByProvider(models: ModelInfo[]): Record<string, ModelInfo[]> {
  return models.reduce((grouped, model) => {
    const key = model.providerName || 'unknown';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(model);
    return grouped;
  }, {} as Record<string, ModelInfo[]>);
}

/**
 * Extract capabilities from model data
 */
export function extractModelCapabilities(model: any): string[] {
  const capabilities = [];
  
  // Vision capabilities
  if (model.architecture?.modality?.includes("image")) {
    capabilities.push("vision");
  }
  
  // Context size capabilities
  if (model.context_length) {
    if (model.context_length >= 128000) {
      capabilities.push("extreme_context");
    } else if (model.context_length >= 32000) {
      capabilities.push("very_long_context");
    } else if (model.context_length >= 16000) {
      capabilities.push("long_context");
    }
  }
  
  // More capabilities based on model architecture or other properties
  if (model.id.includes("function") || model.id.includes("gpt-4") || model.id.includes("claude-3")) {
    capabilities.push("function_calling");
  }
  
  return capabilities;
}