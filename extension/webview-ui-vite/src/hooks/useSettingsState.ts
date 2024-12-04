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
		isInlineEditingEnabled: extensionState.inlineEditMode || false,
		isAdvanceThinkingEnabled: extensionState.advanceThinkingMode || false,
	})
	const [commandTimeout, setCommandTimeout] = useState(extensionState.commandTimeout)

	// 		inlineEditingType: extensionState.inlineEditModeType || "full",
	const [inlineEditingType, setInlineEditingType] = useState(extensionState.inlineEditModeType || "full")
	const [customInstructions, setCustomInstructions] = useState(extensionState.customInstructions || "")
	const [autoSkipWrite, setAutoSkipWrite] = useState(extensionState.skipWriteAnimation || false)
	const [systemPromptVariants, setSystemPromptVariants] = useState<SystemPromptVariant[]>(
		extensionState.systemPromptVariants || []
	)
	const [activeVariantId, setActiveVariantId] = useState<string | null>(
		extensionState.activeSystemPromptVariantId || (systemPromptVariants[0]?.id ?? null)
	)
	const [terminalCompressionThreshold, setTerminalCompressionThreshold] = useState<number | undefined>(
		extensionState.terminalCompressionThreshold
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
				if (featureId === "autoSummarize") {
					extensionState.setAutoSummarize(checked)
					vscode.postMessage({ type: "autoSummarize", bool: checked })
				}
				if (featureId === "isContinueGenerationEnabled") {
					extensionState.setIsContinueGenerationEnabled(checked)
					vscode.postMessage({ type: "isContinueGenerationEnabled", bool: checked })
				}
				if (featureId === "isInlineEditingEnabled") {
					extensionState.setInlineEditMode(checked)
					vscode.postMessage({ type: "setInlinedMode", bool: checked })
				}
				if (featureId === "isAdvanceThinkingEnabled") {
					extensionState.setAdvanceThinkingMode(checked)
					vscode.postMessage({ type: "setAdvanceThinkingMode", bool: checked })
				}
				return newState
			})
		},
		[extensionState]
	)

	const handleCommandTimeout = useCallback((val: number) => {
		setCommandTimeout(val)
		vscode.postMessage({ type: "commandTimeout", commandTimeout: val })
	}, [])

	const handleInlineEditingTypeChange = useCallback((type: "full" | "diff" | "none") => {
		setInlineEditingType(type)
		vscode.postMessage({ type: "setInlineEditMode", inlineEditOutputType: type })
	}, [])

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
			extensionState.setCustomInstructions(val)
			vscode.postMessage({ type: "customInstructions", text: val })
		},
		[extensionState.customInstructions]
	)

	const handleTerminalCompressionThresholdChange = useCallback((val: number | undefined) => {
		setTerminalCompressionThreshold(val)
		vscode.postMessage({ type: "terminalCompressionThreshold", value: val })
	}, [])

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
		terminalCompressionThreshold,
		inlineEditingType,
		commandTimeout,
		handleCommandTimeout,
		handleInlineEditingTypeChange,
		handleTerminalCompressionThresholdChange,
		handleAutoSkipWriteChange,
		handleExperimentalFeatureChange,
		handleTechnicalLevelChange,
		handleModelChange,
		handleBrowserModelChange,
		handleSetReadOnly,
		handleSetAutoCloseTerminal,
		handleSaveSystemPrompt,
		handleDeleteSystemPrompt,
		handleSetActiveVariant,
		handleCustomInstructionsChange,
	}
}
