// OpenRouter model cache manager
import axios from "axios"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { ModelInfo } from "../types"
import { PROVIDER_IDS } from "../constants"

// Cache lifetime (1 hour in milliseconds)
const CACHE_LIFETIME = 60 * 60 * 1000

// Cache file name
const OPENROUTER_MODELS_FILENAME = "openrouter-models.json"

/**
 * OpenRouter Model Cache Manager - Singleton class to handle caching OpenRouter models
 */
export class OpenRouterModelCache {
	private static instance: OpenRouterModelCache | null = null
	private context: vscode.ExtensionContext
	private cache: ModelInfo[] = []
	private lastFetched: number = 0
	private isFetching: boolean = false

	private constructor(context: vscode.ExtensionContext) {
		this.context = context
	}

	/**
	 * Get singleton instance
	 */
	public static getInstance(context?: vscode.ExtensionContext): OpenRouterModelCache {
		if (!OpenRouterModelCache.instance) {
			if (!context) {
				throw new Error("Context must be provided when creating the OpenRouterModelCache instance")
			}
			OpenRouterModelCache.instance = new OpenRouterModelCache(context)
		}
		return OpenRouterModelCache.instance
	}

	/**
	 * Check if cache is stale
	 */
	private isCacheStale(): boolean {
		return Date.now() - this.lastFetched > CACHE_LIFETIME
	}

	/**
	 * Get cache file path
	 */
	private async getCacheFilePath(): Promise<string> {
		const cacheDir = await this.ensureCacheDirectoryExists()
		return path.join(cacheDir, OPENROUTER_MODELS_FILENAME)
	}

	/**
	 * Ensures the cache directory exists
	 */
	private async ensureCacheDirectoryExists(): Promise<string> {
		const cacheDir = path.join(this.context.globalStorageUri.fsPath, "cache")
		try {
			await fs.mkdir(cacheDir, { recursive: true })
		} catch (error) {
			console.error("Error creating cache directory:", error)
		}
		return cacheDir
	}

	/**
	 * Load models from cache file
	 */
	private async loadFromCache(): Promise<ModelInfo[]> {
		try {
			const cacheFilePath = await this.getCacheFilePath()
			const data = await fs.readFile(cacheFilePath, "utf-8")
			return JSON.parse(data)
		} catch (error) {
			console.log("No cache file found or error reading cache, will fetch fresh models")
			return []
		}
	}

	/**
	 * Save models to cache file
	 */
	private async saveToCache(models: ModelInfo[]): Promise<void> {
		try {
			const cacheFilePath = await this.getCacheFilePath()
			await fs.writeFile(cacheFilePath, JSON.stringify(models, null, 2))
			console.log("OpenRouter models saved to cache")
		} catch (error) {
			console.error("Error saving OpenRouter models to cache:", error)
		}
	}

	/**
	 * Fetch models from OpenRouter API
	 */
	private async fetchModelsFromApi(): Promise<ModelInfo[]> {
		try {
			console.log("Fetching fresh OpenRouter models")
			const response = await axios.get("https://openrouter.ai/api/v1/models", {
				headers: {
					"HTTP-Referer": "https://kodu.ai", // Required by OpenRouter
					"X-Title": "Kodu.ai",
				},
			})

			if (response.status !== 200 || !response.data?.data) {
				throw new Error(`Failed to fetch OpenRouter models: ${response.statusText}`)
			}

			// Transform OpenRouter models to our format
			const models = response.data.data.map((model: any): ModelInfo => {
				// Parse pricing data if available
				const inputPrice = model.pricing?.prompt ? parseFloat(model.pricing.prompt) * 1000000 : 5
				const outputPrice = model.pricing?.completion ? parseFloat(model.pricing.completion) * 1000000 : 15

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
				}

				if (model.id.includes("anthropic")) {
					modelInfo.supportsPromptCache = true
					// Cache write tokens are 25% more expensive than base input tokens
					// Cache read tokens are 90% cheaper than base input tokens
					// Regular input and output tokens are priced at standard rates
					modelInfo.inputPrice = inputPrice
					modelInfo.outputPrice = outputPrice
					modelInfo.cacheWritesPrice = inputPrice * 1.25
					modelInfo.cacheReadsPrice = inputPrice * 0.1
				}
				if (model.id === "deepseek/deepseek-chat") {
					modelInfo.supportsPromptCache = true
					modelInfo.inputPrice = 0
					modelInfo.cacheWritesPrice = 0.14
					modelInfo.cacheReadsPrice = 0.014
				}

				return modelInfo
			})

			return models
		} catch (error) {
			console.error("Error fetching OpenRouter models:", error)
			return []
		}
	}

	/**
	 * Get models - returns cached models or fetches new ones if cache is stale
	 */
	public async getModels(): Promise<ModelInfo[]> {
		// If we already have a cache and it's not stale, return it
		if (this.cache.length > 0 && !this.isCacheStale()) {
			return this.cache
		}

		// If we're already fetching, wait a bit and try again
		if (this.isFetching) {
			await new Promise((resolve) => setTimeout(resolve, 500))
			return this.getModels()
		}

		try {
			this.isFetching = true

			// Try to load from file cache first
			if (this.cache.length === 0) {
				this.cache = await this.loadFromCache()

				// If we got models from the cache and they're not stale, use them
				if (this.cache.length > 0 && !this.isCacheStale()) {
					return this.cache
				}
			}

			// If cache is stale or empty, fetch new models
			const models = await this.fetchModelsFromApi()

			if (models.length > 0) {
				this.cache = models
				this.lastFetched = Date.now()
				await this.saveToCache(models)
			}

			return this.cache
		} finally {
			this.isFetching = false
		}
	}
}
