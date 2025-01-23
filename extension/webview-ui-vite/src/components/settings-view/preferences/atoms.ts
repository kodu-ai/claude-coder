import { showSettingsAtom, useExtensionState } from "@/context/extension-state-context"
import { ProviderId } from "extension/api/providers/constants"
import {
	AmazonBedrockSettings,
	GoogleVertexSettings,
	ProviderSettings,
	ProviderType,
} from "extension/api/providers/types"
import { ExtensionMessage } from "extension/shared/messages/extension-message"
import { atom, useSetAtom } from "jotai"
import { useEvent } from "react-use"

export const preferencesViewAtom = atom<"select-model" | "provider-manager">("select-model")
export const forceViewAtom = atom<"select-model" | "provider-manager">("select-model")

export const providerSettingsAtom = atom<ProviderSettings | null>(null)

export const useSwitchView = () => {
	const setPreferencesView = useSetAtom(preferencesViewAtom)
	return (view: "select-model" | "provider-manager") => {
		setPreferencesView(view)
	}
}

export const tabItems = [
	{ value: "preferences", label: "Preferences" },
	{ value: "experimental", label: "Experimental" },
	{ value: "advanced", label: "Advanced" },
	{ value: "agents", label: "Agents" },
] as const

export type PreferencesTab = (typeof tabItems)[number]["value"]

export const preferencesTabAtom = atom<PreferencesTab>("preferences")
export const useSwitchToProviderManager = () => {
	const setProviderSettings = useSetAtom(providerSettingsAtom)
	const setPreferencesView = useSetAtom(preferencesViewAtom)
	const setShowSettings = useSetAtom(showSettingsAtom)
	const setPreferencesTab = useSetAtom(preferencesTabAtom)
	const setForceView = useSetAtom(forceViewAtom)
	return (providerId: ProviderId) => {
		console.log("switching to provider manager for", providerId)
		setShowSettings(true)
		setPreferencesTab("preferences")
		setProviderSettings(createDefaultSettings(providerId))
		setForceView("provider-manager")
		setPreferencesView("provider-manager")
	}
}

export const createDefaultSettings = (providerId: ProviderType): ProviderSettings => {
	const baseSettings = {
		providerId,
	}

	switch (providerId) {
		case "google-vertex":
			return {
				...baseSettings,
				providerId: "google-vertex",
				clientEmail: "",
				privateKey: "",
				project: "",
				location: "",
			}
		case "amazon-bedrock":
			return {
				...baseSettings,
				providerId: "amazon-bedrock",
				region: "",
				accessKeyId: "",
				secretAccessKey: "",
			}
		case "openai-compatible":
			return {
				...baseSettings,
				providerId: "openai-compatible",
				modelId: "",
				baseUrl: "",
				apiKey: "",
				supportImages: false,
				inputLimit: "",
				outputLimit: "",
				inputTokensPrice: 0,
				outputTokensPrice: 0,
				cacheReadsPrice: 0,
				cacheWritesPrice: 0,
			}
		default:
			return {
				...baseSettings,
				apiKey: "",
			} as ProviderSettings
	}
}

/**
 * handle webview message that we need to switch to provider manager and configure a provider before starting a task
 */
export const useRequiredProviderHandler = () => {
	const setPreferencesView = useSetAtom(preferencesViewAtom)
	const setProviderSettings = useSetAtom(providerSettingsAtom)
	const setShowSettings = useSetAtom(showSettingsAtom)

	// type === configureApiRequired
	useEvent("message", (e: MessageEvent) => {
		const message = e.data as ExtensionMessage
		if (message.type === "configureApiRequired") {
			setPreferencesView("provider-manager")
			setProviderSettings(message.providerId ? createDefaultSettings(message.providerId) : null)
			setShowSettings(true)
		}
	})
}
