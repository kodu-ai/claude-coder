import { z } from "zod"
import { procedure } from "../utils"
import { router } from "../utils/router"
import { SecretStateManager } from "../../providers/state/secret-state-manager"
import { nanoid } from "nanoid"
import { models, providerConfigs, customProvidersConfigs } from "../../api/providers/config"
import { ProviderSettings } from "../../api/providers/types"
import { GlobalStateManager } from "../../providers/state/global-state-manager"
import { ProviderId } from "../../api/providers/constants"

// Schema for provider settings validation
const providerSettingsSchema = z.object({
	id: z.string(),
	providerId: z.string(),
	modelId: z.string(),
	apiKey: z.string().optional(),
	// Google Vertex specific fields
	clientEmail: z.string().optional(),
	privateKey: z.string().optional(),
	project: z.string().optional(),
	location: z.string().optional(),
	// Amazon Bedrock specific fields
	region: z.string().optional(),
	accessKeyId: z.string().optional(),
	secretAccessKey: z.string().optional(),
	sessionToken: z.string().optional(),
})

export async function getProvider(id: string) {
	const providersString = await SecretStateManager.getInstance().getSecretState("providers")
	const providers = z.array(providerSettingsSchema).safeParse(JSON.parse(providersString || "[]")).data
	const provider = providers?.find((p) => p.id === id)

	return { provider }
}

export async function getModelProviderData(providerId: string) {
	const providerConfig = providerConfigs[providerId]
	if (!providerConfig) {
		throw new Error(`Invalid provider: ${providerId}`)
	}
	const providersData = await SecretStateManager.getInstance().getSecretState("providers")
	const providers = z.array(providerSettingsSchema).safeParse(JSON.parse(providersData || "[]")).data ?? []
	const currentProvider = providers.find((p) => p.providerId === providerId)

	return {
		providerId,
		models: providerConfig.models,
		currentProvider,
	}
}

const providerRouter = router({
	listModels: procedure.input(z.object({})).resolve(async (ctx, input) => {
		return {
			models: models,
		}
	}),

	currentModel: procedure.input(z.object({})).resolve(async (ctx, input) => {
		const apiConfig = GlobalStateManager.getInstance().getGlobalState("apiConfig")
		return { modelId: apiConfig?.modelId }
	}),

	selectModel: procedure
		.input(z.object({ providerId: z.string(), modelId: z.string() }))
		.resolve(async (ctx, input) => {
			const providerConfig = providerConfigs[input.providerId]
			if (!providerConfig) {
				throw new Error(`Invalid provider: ${input.providerId}`)
			}

			const modelExists = providerConfig.models.some((m) => m.id === input.modelId)
			if (!modelExists) {
				throw new Error(`Invalid model for provider ${input.providerId}: ${input.modelId}`)
			}

			await GlobalStateManager.getInstance().updateGlobalState("apiConfig", {
				providerId: input.providerId as ProviderId,
				modelId: input.modelId,
			})

			return { success: true }
		}),

	listProviders: procedure.input(z.object({})).resolve(async (ctx, input) => {
		const providersString = await SecretStateManager.getInstance().getSecretState("providers")
		const providers = z.array(providerSettingsSchema).safeParse(JSON.parse(providersString || "[]")).data

		return { providers: providers ?? [] }
	}),

	getProvider: procedure.input(z.object({ id: z.string() })).resolve(async (ctx, input) => {
		const { provider } = await getProvider(input.id)
		return { provider }
	}),

	createProvider: procedure.input(providerSettingsSchema).resolve(async (ctx, input) => {
		const providersString = await SecretStateManager.getInstance().getSecretState("providers")
		const providers = z.array(providerSettingsSchema).safeParse(JSON.parse(providersString || "[]")).data ?? []

		// Validate that the provider and model exist
		const providerConfig = providerConfigs[input.providerId]
		if (!providerConfig) {
			throw new Error(`Invalid provider: ${input.providerId}`)
		}

		const modelExists = providerConfig.models.some((m) => m.id === input.modelId)
		if (!modelExists) {
			throw new Error(`Invalid model for provider ${input.providerId}: ${input.modelId}`)
		}

		const newProvider = { ...input, id: input.id || nanoid() }
		const newProviders = [...providers, newProvider]

		await SecretStateManager.getInstance().updateSecretState("providers", JSON.stringify(newProviders))

		return { provider: newProvider }
	}),

	updateProvider: procedure.input(providerSettingsSchema).resolve(async (ctx, input) => {
		const providersString = await SecretStateManager.getInstance().getSecretState("providers")
		const providers = z.array(providerSettingsSchema).safeParse(JSON.parse(providersString || "[]")).data ?? []

		// Validate that the provider and model exist
		const providerConfig = providerConfigs[input.providerId]
		if (!providerConfig) {
			throw new Error(`Invalid provider: ${input.providerId}`)
		}

		const modelExists = providerConfig.models.some((m) => m.id === input.modelId)
		if (!modelExists) {
			throw new Error(`Invalid model for provider ${input.providerId}: ${input.modelId}`)
		}

		const newProviders = providers.map((p) => (p.id === input.id ? input : p))
		await SecretStateManager.getInstance().updateSecretState("providers", JSON.stringify(newProviders))

		return { provider: input }
	}),

	deleteProvider: procedure.input(z.object({ id: z.string() })).resolve(async (ctx, input) => {
		const providersString = await SecretStateManager.getInstance().getSecretState("providers")
		const providers = z.array(providerSettingsSchema).safeParse(JSON.parse(providersString || "[]")).data ?? []
		const newProviders = providers.filter((p) => p.id !== input.id)

		await SecretStateManager.getInstance().updateSecretState("providers", JSON.stringify(newProviders))

		return { success: true }
	}),
})

export default providerRouter
