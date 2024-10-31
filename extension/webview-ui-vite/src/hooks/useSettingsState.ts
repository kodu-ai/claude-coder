import { useState, useCallback } from "react"
import { useExtensionState } from "../context/ExtensionStateContext"
import { vscode } from "../utils/vscode"
import useDebounce from "./use-debounce"
import { GlobalState } from "../../../src/providers/claude-coder/state/GlobalStateManager"
import { SystemPromptVariant } from "../../../src/shared/SystemPromptVariant"

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
		"one-click-deployment": false,
		"auto-summarize-chat": false,
	})
	const [customInstructions, setCustomInstructions] = useState(extensionState.customInstructions || "")
	const [autoSkipWrite, setAutoSkipWrite] = useState(extensionState.skipWriteAnimation || false)
	const [systemPromptVariants, setSystemPromptVariants] = useState<SystemPromptVariant[]>(
		extensionState.systemPromptVariants || []
	)
	const [activeVariantId, setActiveVariantId] = useState<string | null>(
		extensionState.activeSystemPromptVariantId || (systemPromptVariants[0]?.id ?? null)
	)

	const handleAutoSkipWriteChange = useCallback((checked: boolean) => {
		setAutoSkipWrite(checked)
		vscode.postMessage({ type: "skipWriteAnimation", bool: checked })
	}, [])

	const handleExperimentalFeatureChange = useCallback(
		(featureId: keyof GlobalState, checked: boolean) => {
			setExperimentalFeatureStates((prev) => {
				const newState = { ...prev, [featureId]: checked }
				if (featureId === "alwaysAllowWriteOnly") {
					extensionState.setAlwaysAllowWriteOnly(checked)
					vscode.postMessage({ type: "alwaysAllowWriteOnly", bool: checked })
				}
				return newState
			})
		},
		[extensionState]
	)

	const handleTechnicalLevelChange = useCallback((setLevel: typeof technicalLevel) => {
		console.log(`Setting technical level to: ${setLevel}`)
		setTechnicalLevel(setLevel!)
		vscode.postMessage({ type: "technicalBackground", value: setLevel! })
	}, [])

	const handleModelChange = useCallback((newModel: typeof model) => {
		setModel(newModel!)
		vscode.postMessage({ type: "apiConfiguration", apiConfiguration: { apiModelId: newModel } })
	}, [])

	const handleBrowserModelChange = useCallback((newModel: typeof model) => {
		setBrowserModel(newModel!)
		vscode.postMessage({ type: "apiConfiguration", apiConfiguration: { browserModelId: newModel } })
	}, [])

	const handleSetReadOnly = useCallback((checked: boolean) => {
		setReadOnly(checked)
		vscode.postMessage({ type: "alwaysAllowReadOnly", bool: checked })
	}, [])

	const handleSetAutoCloseTerminal = useCallback((checked: boolean) => {
		setAutoCloseTerminal(checked)
		vscode.postMessage({ type: "autoCloseTerminal", bool: checked })
	}, [])

	const handleSaveSystemPrompt = useCallback((variant: SystemPromptVariant) => {
		setSystemPromptVariants((prev) => {
			const updatedVariants = prev.map((v) => v.id === variant.id ? variant : v)
			if (!prev.find(v => v.id === variant.id)) {
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

	useDebounce(customInstructions, 250, (val) => {
		if (val === extensionState.customInstructions) return
		extensionState.setCustomInstructions(val)
		vscode.postMessage({ type: "customInstructions", text: val })
	})

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
		handleAutoSkipWriteChange,
		handleExperimentalFeatureChange,
		handleTechnicalLevelChange,
		handleModelChange,
		handleBrowserModelChange,
		handleSetReadOnly,
		handleSetAutoCloseTerminal,
		setCustomInstructions,
		handleSaveSystemPrompt,
		handleDeleteSystemPrompt,
		handleSetActiveVariant,
	}
}