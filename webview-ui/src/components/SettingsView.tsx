import {
	VSCodeButton,
	VSCodeCheckbox,
	VSCodeLink,
	VSCodeRadio,
	VSCodeRadioGroup,
	VSCodeTextArea,
	VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react"
import { ChangeEvent, useEffect, useState } from "react"
import { useExtensionState } from "../context/ExtensionStateContext"
import { validateApiConfiguration, validateMaxRequestsPerTask } from "../utils/validate"
import { vscode } from "../utils/vscode"
import ApiOptions from "./ApiOptions"

const IS_DEV = false // FIXME: use flags when packaging

type SettingsViewProps = {
	onDone: () => void
}
const modeDescriptions = {
	normal: "Balanced creativity and consistency in code generation.",
	deterministic: "Produces consistent code generation and similar coding style.",
	creative:
		"Generates more varied and imaginative coding style, might produce unexpected results. and sometimes might solve tasks that are not solvable in other modes.",
} as const

const SettingsView = ({ onDone }: SettingsViewProps) => {
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

		setMaxRequestsErrorMessage(maxRequestsValidationResult)
		console.log("apiValidationResult", apiValidationResult)
		console.log("maxRequestsValidationResult", maxRequestsValidationResult)

		if (!maxRequestsValidationResult) {
			console.log("sending message")
			console.log(JSON.stringify(apiConfiguration))
			vscode.postMessage({ type: "apiConfiguration", apiConfiguration })
			vscode.postMessage({ type: "maxRequestsPerTask", text: maxRequestsPerTaskString })
			vscode.postMessage({ type: "alwaysAllowWriteOnly", bool: alwaysAllowWriteOnly })
			vscode.postMessage({ type: "customInstructions", text: customInstructions })
			vscode.postMessage({ type: "alwaysAllowReadOnly", bool: alwaysAllowReadOnly })
			vscode.postMessage({ type: "setCreativeMode", text: creativeMode })
			onDone()
		}
	}

	useEffect(() => {
		setMaxRequestsErrorMessage(undefined)
	}, [maxRequestsPerTask])

	// validate as soon as the component is mounted
	/*
	useEffect will use stale values of variables if they are not included in the dependency array. so trying to use useEffect with a dependency array of only one value for example will use any other variables' old values. In most cases you don't want this, and should opt to use react-use hooks.
	
	useEffect(() => {
		// uses someVar and anotherVar
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [someVar])

	If we only want to run code once on mount we can use react-use's useEffectOnce or useMount
	*/

	const handleResetState = () => {
		vscode.postMessage({ type: "resetState" })
	}

	return (
		<div
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

				<div className="creativity-mode-selector">
					<span style={{ color: "var(--vscode-foreground)" }}>Select Creativity Mode:</span>
					<VSCodeRadioGroup value={creativeMode} onChange={(e: any) => setCreativeMode(e.target.value)}>
						<VSCodeRadio value="normal">Normal</VSCodeRadio>
						<VSCodeRadio value="deterministic">Deterministic</VSCodeRadio>
						<VSCodeRadio value="creative">Creative</VSCodeRadio>
					</VSCodeRadioGroup>
					<span style={{ marginTop: 5, color: "var(--vscode-descriptionForeground)" }}>
						{modeDescriptions[creativeMode]}
					</span>
				</div>

				<div style={{ marginBottom: 5 }}>
					<VSCodeCheckbox
						checked={alwaysAllowReadOnly}
						onChange={(e: any) => {
							setAlwaysAllowReadOnly(!!e.target?.checked)
							if (!e.target?.checked) {
								setAlwaysAllowWriteOnly(false)
							}
						}}>
						<span style={{ fontWeight: "500" }}>Always allow read-only operations</span>
					</VSCodeCheckbox>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						When enabled, Claude will automatically read files and view directories without requiring you to
						click the Allow button.
					</p>
				</div>

				<div style={{ marginBottom: 5 }}>
					<VSCodeCheckbox
						checked={alwaysAllowWriteOnly}
						// @ts-expect-error - this is a bug in the toolkit
						onChange={(e: ChangeEvent<HTMLInputElement>) => switchAutomaticMode(!!e.target?.checked)}>
						<span style={{ fontWeight: "500" }}>Automatic mode</span>
					</VSCodeCheckbox>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						When enabled, Claude will automatically try to solve the task without asking for your
						permission.
						<br />
						*Use with caution, as this may lead to unintended consequences.*
						<br />
						*This feature is highly experimental and may not work as expected.*
					</p>
				</div>
				<div style={{ marginBottom: 5 }}>
					<VSCodeTextArea
						value={customInstructions ?? ""}
						style={{ width: "100%" }}
						rows={4}
						placeholder={
							'e.g. "Run unit tests at the end", "Use TypeScript with async/await", "Speak in Spanish"'
						}
						onInput={(e: any) => setCustomInstructions(e.target?.value ?? "")}>
						<span style={{ fontWeight: "500" }}>Custom Instructions</span>
					</VSCodeTextArea>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						These instructions are added to the end of the system prompt sent with every request. Not sure
						what to put here or want to share your ideas? Check out Kodu's{" "}
						<VSCodeLink href="https://www.kodu.ai/community-prompts" style={{ display: "inline" }}>
							community prompts
						</VSCodeLink>
						page!
					</p>
				</div>

				<div>
					<VSCodeTextField
						value={maxRequestsPerTaskString}
						style={{ width: "100%" }}
						placeholder="20"
						onInput={(e: any) => setMaxRequestsPerTaskString(e.target?.value ?? "")}>
						<span style={{ fontWeight: "500" }}>Maximum # Requests Per Task</span>
					</VSCodeTextField>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						If Claude Dev reaches this limit, it will pause and ask for your permission before making
						additional requests.
					</p>
					{maxRequestsErrorMessage && (
						<p
							style={{
								fontSize: "12px",
								marginTop: "5px",
								color: "var(--vscode-errorForeground)",
							}}>
							{maxRequestsErrorMessage}
						</p>
					)}
				</div>

				{true && (
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
					<p style={{ wordWrap: "break-word", margin: 0, padding: 0 }}>
						If you have any questions or feedback, feel free to open an issue at{" "}
						<VSCodeLink
							href="https://github.com/kodu-ai/claude-dev-experimental"
							style={{ display: "inline" }}>
							https://github.com/kodu-ai/claude-dev-experimental
						</VSCodeLink>
					</p>
					<p style={{ fontStyle: "italic", margin: "10px 0 0 0", padding: 0 }}>v{version}</p>
				</div>
			</div>
		</div>
	)
}

export default SettingsView
