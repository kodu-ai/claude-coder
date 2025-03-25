// providers/openrouter.ts
import { ProviderConfig } from "../types"
import { DEFAULT_BASE_URLS, PROVIDER_IDS, PROVIDER_NAMES } from "../constants"
import { OpenRouterModelCache } from "./openrouter-cache"
import { transformOpenRouterModel, groupModelsByProvider } from "./openrouter-enhanced"
import axios from "axios"
import delay from "delay"

// Initial config with empty models array that will be filled from cache
export const openRouterConfig: ProviderConfig = {
	id: PROVIDER_IDS.OPENROUTER,
	name: PROVIDER_NAMES[PROVIDER_IDS.OPENROUTER],
	baseUrl: DEFAULT_BASE_URLS[PROVIDER_IDS.OPENROUTER],
	models: [], // This will be populated from cache
	requiredFields: ["apiKey"],
	getModels: () => OpenRouterModelCache.getInstance().getModels(),
	// Dodajemy grupowanie i organizację modeli według dostawcy
	groupModels: (models) => groupModelsByProvider(models),
	// Dodajemy transformację modeli z wykorzystaniem ulepszonej funkcji
	transformModel: (model) => transformOpenRouterModel(model),
}

// get generation data

const withRetry = async (fn: () => Promise<any>, retries = 5, initialDelay = 250) => {
	let lastError: any
	for (let i = 0; i < retries; i++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error
			// Only delay if this is not the last attempt
			if (i < retries - 1) {
				await delay((i + 1) * initialDelay) // Incremental delay
			}
		}
	}
	throw lastError
}

export const getOpenrouterGenerationData = async (id: string, apiKey: string) => {
	return withRetry(async () => {
		const generation = await axios.get(`https://openrouter.ai/api/v1/generation?id=${id}`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		})
		const generationData = generation.data
		return generationData.data as GenerationData
	})
}

type GenerationData = {
	id: string
	upstream_id: string
	total_cost: number
	cache_discount: number
	provider_name: string
	created_at: string
	model: string
	app_id: string | null
	streamed: boolean
	cancelled: boolean
	latency: number
	moderation_latency: number | null
	generation_time: number
	tokens_prompt: number
	tokens_completion: number
	native_tokens_prompt: number
	native_tokens_completion: number
	native_tokens_reasoning: number
	num_media_prompt: number | null
	num_media_completion: number | null
	num_search_results: number | null
	origin: string
	is_byok: boolean
	finish_reason: string
	native_finish_reason: string
	usage: number
}
