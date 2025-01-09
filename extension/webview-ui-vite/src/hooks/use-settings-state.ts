import { useCallback, useState } from "react"
import { GlobalState } from "../../../src/providers/state/global-state-manager"
import { useExtensionState } from "../context/extension-state-context"
import { vscode } from "../utils/vscode"

export function useSettingsState() {
	const extensionState = useExtensionState()
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
		handleSetReadOnly,
		handleSetAutoCloseTerminal,
		handleSetGitHandlerEnabled,
		handleCustomInstructionsChange,
	}
}
