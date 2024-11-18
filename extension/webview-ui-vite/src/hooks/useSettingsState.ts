import { useCallback, useState } from "react"
import { GlobalState } from "../../../src/providers/claude-coder/state/GlobalStateManager"
import { SystemPromptVariant } from "../../../src/shared/SystemPromptVariant"
import { useExtensionState } from "../context/ExtensionStateContext"
import { vscode } from "../utils/vscode"
import useDebounce from "./use-debounce"

export function useSettingsState() {
	const extensionState = useExtensionState()
	const [model, setModel] = useState(extensionState.apiConfiguration?.apiModelId || "claude-3-5-sonnet-20240620")
	const [browserModel, setBrowserModel] = useState(
		extensionState.apiConfiguration?.browserModelId || "claude-3-haiku-20240307"
	)
	const [technicalLevel, setTechnicalLevel] = useState(extensionState.technicalBackground)
	const [readOnly, setReadOnly] = useState(extensionState.alwaysAllowReadOnly || false)
	const [autoCloseTerminal, setAutoCloseTerminal] = useState(extensionState.autoCloseTerminal || false)
	const [experimentalFeatureStates, setExperimentalFeatureStates] = useState({
		alwaysAllowWriteOnly: extensionState.alwaysAllowWriteOnly || false,
		autoSummarize: extensionState.autoSummarize || false,
		"one-click-deployment": false,
		isContinueGenerationEnabled: extensionState.isContinueGenerationEnabled || false,
	})
	const [customInstructions, setCustomInstructions] = useState(extensionState.customInstructions || "")
	const [autoSkipWrite, setAutoSkipWrite] = useState(extensionState.skipWriteAnimation || false)
	const [systemPromptVariants, setSystemPromptVariants] = useState<SystemPromptVariant[]>(
		extensionState.systemPromptVariants || []
	)
	const [activeVariantId, setActiveVariantId] = useState<string | null>(
		extensionState.activeSystemPromptVariantId || (systemPromptVariants[0]?.id ?? null)
	)
	const [useDirectAnthropicApi, setUseDirectAnthropicApi] = useState(extensionState.useDirectAnthropicApi || false)
	const [anthropicApiKey, setAnthropicApiKey] = useState(extensionState.anthropicApiKey || "")

	const handleAutoSkipWriteChange = useCallback((checked: boolean) => {
		setAutoSkipWrite(checked)
		vscode.postMessage({ type: "skipWriteAnimation", bool: checked })
	}, [])

	const handleExperimentalFeatureChange = useCallback(
		(featureId: keyof GlobalState, checked: boolean) => {
			setExperimentalFeatureStates((prev) => {
				const newState = { ...prev, [featureId]: checked }
				if (featureId === "alwaysAllowWriteOnly") {
					vscode.postMessage({ type: "alwaysAllowWriteOnly", bool: checked })
				}
				if (featureId === "autoSummarize") {
					vscode.postMessage({ type: "autoSummarize", bool: checked })
				}
				if (featureId === "isContinueGenerationEnabled") {
					vscode.postMessage({ type: "isContinueGenerationEnabled", bool: checked })
				}
				return newState
			})
		},
		[]
	)

	const handleTechnicalLevelChange = useCallback((setLevel: typeof technicalLevel) => {
		console.log(`Setting technical level to: ${setLevel}`)
		setTechnicalLevel(setLevel!)
		vscode.postMessage({ type: "technicalBackground", value: setLevel! })
	}, [])

	const handleModelChange = useCallback((newModel: typeof model) => {
		setModel(newModel!)
		const newConfig = {
			...extensionState.apiConfiguration,
			apiModelId: newModel
		}
		vscode.postMessage({ type: "apiConfiguration", apiConfiguration: newConfig })
	}, [extensionState.apiConfiguration])

	const handleBrowserModelChange = useCallback((newModel: typeof model) => {
		setBrowserModel(newModel!)
		const newConfig = {
			...extensionState.apiConfiguration,
			browserModelId: newModel
		}
		vscode.postMessage({ type: "apiConfiguration", apiConfiguration: newConfig })
	}, [extensionState.apiConfiguration])

	const handleSetReadOnly = useCallback((checked: boolean) => {
		setReadOnly(checked)
		vscode.postMessage({ type: "alwaysAllowReadOnly", bool: checked })
	}, [])

	const handleSetAutoCloseTerminal = useCallback((checked: boolean) => {
		setAutoCloseTerminal(checked)
		vscode.postMessage({ type: "autoCloseTerminal", bool: checked })
	}, [])

	const handleUseDirectAnthropicApiChange = useCallback((checked: boolean) => {
		setUseDirectAnthropicApi(checked)
		const newConfig = {
			...extensionState.apiConfiguration,
			useDirectAnthropicApi: checked,
			apiProvider: checked ? "anthropic" : undefined,
			// Keep existing API key if turning on direct API
			anthropicApiKey: checked ? (extensionState.anthropicApiKey || anthropicApiKey) : undefined
		}
		vscode.postMessage({ 
			type: "apiConfiguration", 
			apiConfiguration: newConfig
		})
	}, [extensionState.apiConfiguration, extensionState.anthropicApiKey, anthropicApiKey])

	const handleAnthropicApiKeyChange = useCallback((apiKey: string) => {
		setAnthropicApiKey(apiKey)
		const newConfig = {
			...extensionState.apiConfiguration,
			anthropicApiKey: apiKey,
			apiKey: apiKey, // Set both for compatibility
			useDirectAnthropicApi: true, // Ensure direct API is enabled when setting key
			apiProvider: "anthropic"
		}
		vscode.postMessage({ 
			type: "apiConfiguration", 
			apiConfiguration: newConfig
		})
	}, [extensionState.apiConfiguration])

	const handleSaveSystemPrompt = useCallback((variant: SystemPromptVariant) => {
		setSystemPromptVariants((prev) => {
			const updatedVariants = prev.map((v) => (v.id === variant.id ? variant : v))
			if (!prev.find((v) => v.id === variant.id)) {
				updatedVariants.push(variant)
			}
			vscode.postMessage({ type: "systemPromptVariants", variants: updatedVariants })
			return updatedVariants
		})
	}, [])

	const handleDeleteSystemPrompt = useCallback(
		(id: string) => {
			setSystemPromptVariants((prev) => {
				const newVariants = prev.filter((v) => v.id !== id)
				vscode.postMessage({ type: "systemPromptVariants", variants: newVariants })
				// If we're deleting the active variant, set the first available one as active
				if (id === activeVariantId) {
					const newActiveId = newVariants[0]?.id ?? null
					setActiveVariantId(newActiveId)
					vscode.postMessage({ type: "activeSystemPromptVariant", variantId: newActiveId })
				}
				return newVariants
			})
		},
		[activeVariantId]
	)

	const handleSetActiveVariant = useCallback((variantId: string) => {
		setActiveVariantId(variantId)
		vscode.postMessage({ type: "activeSystemPromptVariant", variantId })
	}, [])

	const handleCustomInstructionsChange = useCallback(
		(val: string) => {
			if (val === extensionState.customInstructions) return
			setCustomInstructions(val)
			vscode.postMessage({ type: "customInstructions", text: val })
		},
		[extensionState.customInstructions]
	)

	return {
		model,
		browserModel,
		technicalLevel,
		readOnly,
		autoCloseTerminal,
		experimentalFeatureStates,
		customInstructions,
		autoSkipWrite,
		systemPromptVariants,
		activeVariantId,
		useDirectAnthropicApi,
		anthropicApiKey,
		handleAutoSkipWriteChange,
		handleExperimentalFeatureChange,
		handleTechnicalLevelChange,
		handleModelChange,
		handleBrowserModelChange,
		handleSetReadOnly,
		handleSetAutoCloseTerminal,
		handleUseDirectAnthropicApiChange,
		handleAnthropicApiKeyChange,
		handleSaveSystemPrompt,
		handleDeleteSystemPrompt,
		handleSetActiveVariant,
		handleCustomInstructionsChange,
	}
}
