import { useCallback, useState } from "react"
import { GlobalState } from "../../../src/providers/state/global-state-manager"
import { useExtensionState } from "../context/extension-state-context"
import { vscode } from "../utils/vscode"
import { koduDefaultModelId, koduModels } from "../../../src/shared/api"

export function useSettingsState() {
	const extensionState = useExtensionState()
	const [model, setModel] = useState(extensionState.apiConfiguration?.apiModelId ?? koduDefaultModelId)
	const [browserModel, setBrowserModel] = useState(
		extensionState.apiConfiguration?.browserModelId ?? "claude-3-5-haiku-20241022"
	)
	const [readOnly, setReadOnly] = useState(extensionState.alwaysAllowReadOnly || false)
	const [autoCloseTerminal, setAutoCloseTerminal] = useState(extensionState.autoCloseTerminal || false)
	const [gitHandlerEnabled, setGitHandlerEnabled] = useState(extensionState.gitHandlerEnabled ?? true)
	const [experimentalFeatureStates, setExperimentalFeatureStates] = useState({
		alwaysAllowWriteOnly: extensionState.alwaysAllowWriteOnly || false,
		autoSummarize: extensionState.autoSummarize || false,
		"one-click-deployment": false,
	})
	const [commandTimeout, setCommandTimeout] = useState(extensionState.commandTimeout)
	const [inlineEditingType, setInlineEditingType] = useState(extensionState.inlineEditModeType || "full")
	const [customInstructions, setCustomInstructions] = useState(extensionState.customInstructions || "")
	const [autoSkipWrite, setAutoSkipWrite] = useState(extensionState.skipWriteAnimation || false)

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

				return newState
			})
		},
		[extensionState]
	)

	const handleCommandTimeout = useCallback((val: number) => {
		setCommandTimeout(val)
		vscode.postMessage({ type: "commandTimeout", commandTimeout: val })
	}, [])

	const handleInlineEditingTypeChange = useCallback((type: "full" | "diff") => {
		setInlineEditingType(type)
		vscode.postMessage({ type: "setInlineEditMode", inlineEditOutputType: type })
	}, [])

	const handleModelChange = useCallback((newModel: typeof model) => {
		const isCustomModel = koduModels[newModel] ? false : true
		setModel(newModel!)
		if (isCustomModel) {
			vscode.postMessage({ type: "apiConfiguration", apiConfiguration: { customModel: { id: newModel } } })
		} else {
			vscode.postMessage({ type: "apiConfiguration", apiConfiguration: { apiModelId: newModel } })
		}
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

	const handleSetGitHandlerEnabled = useCallback((checked: boolean) => {
		setGitHandlerEnabled(checked)
		vscode.postMessage({ type: "toggleGitHandler", enabled: checked })
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
		readOnly,
		autoCloseTerminal,
		gitHandlerEnabled,
		experimentalFeatureStates,
		customInstructions,
		autoSkipWrite,
		terminalCompressionThreshold,
		inlineEditingType,
		commandTimeout,
		handleCommandTimeout,
		handleInlineEditingTypeChange,
		handleTerminalCompressionThresholdChange,
		handleAutoSkipWriteChange,
		handleExperimentalFeatureChange,
		handleModelChange,
		handleBrowserModelChange,
		handleSetReadOnly,
		handleSetAutoCloseTerminal,
		handleSetGitHandlerEnabled,
		handleCustomInstructionsChange,
	}
}
