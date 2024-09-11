import React, { useState, useEffect } from "react"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { validateApiConfiguration, validateMaxRequestsPerTask } from "../../utils/validate"
import { vscode } from "../../utils/vscode"
import ApiOptions from "../ApiOptions/ApiOptions"
import CreativityModeSelector from "./CreativityModeSelector"
import CheckboxOption from "./CheckboxOption"
import CustomInstructions from "./CustomInstructions"
import MaxRequestsInput from "./MaxRequestsInput"

const IS_DEV = false // FIXME: use flags when packaging

interface SettingsViewProps {
	onDone: () => void
}

const SettingsView: React.FC<SettingsViewProps> = ({ onDone }) => {
	const {
		apiConfiguration,
		version,
		maxRequestsPerTask,
		customInstructions,
		setCustomInstructions,
		alwaysAllowReadOnly,
		setAlwaysAllowReadOnly,
		setAlwaysAllowWriteOnly,
		setCreativeMode,
		creativeMode,
		alwaysAllowWriteOnly,
	} = useExtensionState()

	const [_, setApiErrorMessage] = useState<string | undefined>(undefined)
	const [maxRequestsErrorMessage, setMaxRequestsErrorMessage] = useState<string | undefined>(undefined)
	const [maxRequestsPerTaskString, setMaxRequestsPerTaskString] = useState<string>(
		maxRequestsPerTask?.toString() || ""
	)

	const switchAutomaticMode = (checked: boolean) => {
		if (checked) {
			setAlwaysAllowReadOnly(true)
			setAlwaysAllowWriteOnly(true)
		} else {
			setAlwaysAllowWriteOnly(false)
		}
	}

	const handleSubmit = () => {
		const apiValidationResult = validateApiConfiguration(apiConfiguration)
		const maxRequestsValidationResult = validateMaxRequestsPerTask(maxRequestsPerTaskString)

		setApiErrorMessage(apiValidationResult)
		setMaxRequestsErrorMessage(maxRequestsValidationResult)

		if (!apiValidationResult && !maxRequestsValidationResult) {
			vscode.postMessage({ type: "apiConfiguration", apiConfiguration: apiConfiguration! })
			vscode.postMessage({ type: "maxRequestsPerTask", text: maxRequestsPerTaskString })
			vscode.postMessage({ type: "alwaysAllowWriteOnly", bool: alwaysAllowWriteOnly })
			vscode.postMessage({ type: "customInstructions", text: customInstructions })
			vscode.postMessage({ type: "alwaysAllowReadOnly", bool: alwaysAllowReadOnly })
			vscode.postMessage({ type: "setCreativeMode", text: creativeMode })
			onDone()
		}
	}

	useEffect(() => {
		setApiErrorMessage(undefined)
	}, [apiConfiguration])

	useEffect(() => {
		setMaxRequestsErrorMessage(undefined)
	}, [maxRequestsPerTask])

	const handleResetState = () => {
		vscode.postMessage({ type: "resetState" })
	}

	return (
		<div
			className="text-start"
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				padding: "10px 0px 0px 20px",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "17px",
					paddingRight: 17,
				}}>
				<h3 style={{ color: "var(--vscode-foreground)", margin: 0 }}>Settings</h3>
				<VSCodeButton onClick={handleSubmit}>Done</VSCodeButton>
			</div>
			<div
				style={{ flexGrow: 1, overflowY: "scroll", paddingRight: 8, display: "flex", flexDirection: "column" }}>
				<div style={{ marginBottom: 5 }}>
					<ApiOptions showModelOptions={true} />
				</div>

				<CreativityModeSelector creativeMode={creativeMode} setCreativeMode={setCreativeMode} />

				<CheckboxOption
					checked={alwaysAllowReadOnly}
					onChange={(checked) => {
						setAlwaysAllowReadOnly(checked)
						if (!checked) {
							setAlwaysAllowWriteOnly(false)
						}
					}}
					label="Always allow read-only operations"
					description="When enabled, Claude will automatically read files and view directories without requiring you to click the Allow button."
				/>

				<CheckboxOption
					checked={alwaysAllowWriteOnly}
					onChange={(checked) => switchAutomaticMode(checked)}
					label="Automatic mode"
					description="When enabled, Claude will automatically try to solve the task without asking for your permission. *Use with caution, as this may lead to unintended consequences.* *This feature is highly experimental and may not work as expected.*"
				/>

				<CustomInstructions value={customInstructions ?? ""} onChange={setCustomInstructions} />

				<MaxRequestsInput
					value={maxRequestsPerTaskString}
					onChange={setMaxRequestsPerTaskString}
					errorMessage={maxRequestsErrorMessage}
				/>

				{IS_DEV && (
					<>
						<div style={{ marginTop: "10px", marginBottom: "4px" }}>Debug</div>
						<VSCodeButton onClick={handleResetState} style={{ marginTop: "5px", width: "auto" }}>
							Reset State
						</VSCodeButton>
						<p
							style={{
								fontSize: "12px",
								marginTop: "5px",
								color: "var(--vscode-descriptionForeground)",
							}}>
							This will reset all global state and secret storage in the extension.
						</p>
					</>
				)}

				<div
					style={{
						textAlign: "center",
						color: "var(--vscode-descriptionForeground)",
						fontSize: "12px",
						lineHeight: "1.2",
						marginTop: "auto",
						padding: "10px 8px 15px 0px",
					}}>
					<div style={{ wordWrap: "break-word", margin: 0, padding: 0 }}>
						If you have any questions or feedback, feel free to open an issue at{" "}
						<VSCodeLink href="https://github.com/kodu-ai/kodu-coder" style={{ display: "inline" }}>
							https://github.com/kodu-ai/kodu-coder
						</VSCodeLink>
					</div>
					<div style={{ fontStyle: "italic", margin: "10px 0 0 0", padding: 0 }}>v{version}</div>
				</div>
			</div>
		</div>
	)
}

export default SettingsView
