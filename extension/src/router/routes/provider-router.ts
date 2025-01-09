import { z } from "zod"
import { procedure } from "../utils"
import { router } from "../utils/router"
import { SecretStateManager } from "../../providers/state/secret-state-manager"
import { nanoid } from "nanoid"
import { models, providerConfigs, customProvidersConfigs } from "../../api/providers/config"
import { GlobalStateManager } from "../../providers/state/global-state-manager"
import { ProviderId } from "../../api/providers/constants"
import { ApiConstructorOptions, ProviderSettings, providerSettingsSchema } from "../../api"

export async function getProvider(id: string) {
	if (id === "kodu") {
		return { provider: providerConfigs.kodu }
	}
	const providersString = await SecretStateManager.getInstance().getSecretState("providers")
	const providers = z.array(providerSettingsSchema).safeParse(JSON.parse(providersString || "[]")).data
	const provider = providers?.find((p) => p.providerId === id)

	return { provider }
}

export async function getModelProviderData(providerId: string) {
	if (providerId === "kodu") {
		const apiKey = await SecretStateManager.getInstance().getSecretState("koduApiKey")
		const providerSettings: ProviderSettings = {
			providerId: "kodu",
			apiKey,
			modelId: "kodu",
		}
		return {
			providerId,
			currentProvider: providerSettings,
			models: providerConfigs.kodu.models,
		}
	}
	const providersData = await SecretStateManager.getInstance().getSecretState("providers")
	const providers = z.array(providerSettingsSchema).safeParse(JSON.parse(providersData || "[]")).data ?? []
	const currentProvider = providers.find((p) => p.providerId === providerId)

	return {
		providerId,
		models: providerConfigs[providerId].models,
		currentProvider,
	}
}

export async function getCurrentApiSettings() {
	const apiConfig = GlobalStateManager.getInstance().getGlobalState("apiConfig")
	const providerData = await getModelProviderData(apiConfig?.providerId ?? "-")
	const { model } = await getCurrentModelInfo()
	return {
		providerSettings: providerData.currentProvider ?? {
			providerId: apiConfig?.providerId ?? "-",
		},
		models: providerData.models,
		model,
	}
}

export async function getCurrentModelInfo() {
	const apiConfig = GlobalStateManager.getInstance().getGlobalState("apiConfig")
	const providerData = await getModelProviderData(apiConfig?.providerId ?? "-")
	const model = providerData.models?.find((m) => m.id === apiConfig?.modelId)
	if (!model) {
		throw new Error(`Model not found: ${apiConfig?.modelId}`)
	}
	return { model, providerData }
}

const providerRouter = router({
	listModels: procedure.input(z.object({})).resolve(async (ctx, input) => {
		return {
			models: models,
		}
	}),

	currentApiSettings: procedure.input(z.object({})).resolve(async (ctx, input) => {
		return getCurrentApiSettings()
	}),

	currentModel: procedure.input(z.object({})).resolve(async (ctx, input) => {
		const apiConfig = GlobalStateManager.getInstance().getGlobalState("apiConfig")
		return { modelId: apiConfig?.modelId }
	}),

	currentModelInfo: procedure.input(z.object({})).resolve(async (ctx, input) => {
		const { model, providerData } = await getCurrentModelInfo()
		const isValidModel = model?.id === providerData.currentProvider?.modelId
		return { model, providerData }
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
			await ctx.provider.koduDev?.getApiManager().pullLatestApi()

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

		const newProvider = { ...input }
		const newProviders = [...providers, newProvider]

		await SecretStateManager.getInstance().updateSecretState("providers", JSON.stringify(newProviders))
		await ctx.provider.koduDev?.getApiManager().pullLatestApi()

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

		const newProviders = providers.map((p) => (p.providerId === input.providerId ? input : p))
		await SecretStateManager.getInstance().updateSecretState("providers", JSON.stringify(newProviders))
		await ctx.provider.koduDev?.getApiManager().pullLatestApi()

		return { provider: input }
	}),

	deleteProvider: procedure.input(z.object({ id: z.string() })).resolve(async (ctx, input) => {
		const providersString = await SecretStateManager.getInstance().getSecretState("providers")
		const providers = z.array(providerSettingsSchema).safeParse(JSON.parse(providersString || "[]")).data ?? []
		const newProviders = providers.filter((p) => p.providerId !== input.id)

		await SecretStateManager.getInstance().updateSecretState("providers", JSON.stringify(newProviders))
		await ctx.provider.koduDev?.getApiManager().pullLatestApi()

		return { success: true }
	}),
})

export default providerRouter
