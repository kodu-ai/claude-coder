import React, { useState, useEffect } from "react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { validateApiConfiguration, validateMaxRequestsPerTask } from "../../utils/validate"
import { vscode } from "../../utils/vscode"
import ApiOptions from "../ApiOptions/ApiOptions"
import CreativityModeSelector from "./CreativityModeSelector"
import CustomInstructions from "./CustomInstructions"
import MaxRequestsInput from "./MaxRequestsInput"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import TechnicalLevelSelector from "./TechnicalLevelSelector"

const IS_DEV = true // FIXME: use flags when packaging

interface SettingsViewProps {
	onDone: () => void
}

const SettingsView: React.FC<SettingsViewProps> = ({ onDone }) => {
	const {
		apiConfiguration,
		version,
		maxRequestsPerTask,
		customInstructions,
		experimentalTerminal,
		setExperimentalTerminal,
		setCustomInstructions,
		alwaysAllowReadOnly,
		setAlwaysAllowReadOnly,
		setAlwaysAllowWriteOnly,
		setCreativeMode,
		creativeMode,
		alwaysAllowWriteOnly,
		setTechnicalBackground,
		technicalBackground,
		useUdiff,
		setUseUdiff,
		user,
	} = useExtensionState()

	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined)
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
			// vscode.postMessage({ type: "useUdiff", bool: useUdiff })
			vscode.postMessage({ type: "experimentalTerminal", bool: experimentalTerminal })
			vscode.postMessage({ type: "technicalBackground", value: technicalBackground! })
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
		<div className="text-start fixed inset-0 p-4 flex flex-col overflow-hidden">
			<div className="flex justify-between items-center mb-4">
				<h3 className="text-base font-semibold m-0">Settings</h3>
				<Button onClick={handleSubmit} size="sm">
					Done
				</Button>
			</div>
			<ScrollArea className="flex-grow pr-2">
				<div className="space-y-4">
					<div className="mb-1">
						<ApiOptions showModelOptions={true} />
					</div>

					<TechnicalLevelSelector
						technicalBackground={technicalBackground}
						setTechnicalBackground={setTechnicalBackground}
					/>
					<CreativityModeSelector creativeMode={creativeMode} setCreativeMode={setCreativeMode} />

					<div className="flex items-start space-x-2">
						<Checkbox
							id="always-allow-read-only"
							checked={alwaysAllowReadOnly}
							onCheckedChange={(checked) => {
								setAlwaysAllowReadOnly(checked as boolean)
								if (!checked) {
									setAlwaysAllowWriteOnly(false)
								}
							}}
						/>
						<div>
							<label htmlFor="always-allow-read-only" className="text-sm font-medium cursor-pointer">
								Always allow read-only operations
							</label>
							<p className="text-xs text-muted-foreground">
								When enabled, Claude will automatically read files and view directories without
								requiring you to click the Allow button.
							</p>
						</div>
					</div>

					<div className="flex items-start space-x-2">
						<Checkbox
							id="automatic-mode"
							checked={alwaysAllowWriteOnly}
							onCheckedChange={(checked) => switchAutomaticMode(checked as boolean)}
						/>
						<div>
							<label htmlFor="automatic-mode" className="text-sm font-medium cursor-pointer">
								Automatic mode
							</label>
							<p className="text-xs text-muted-foreground">
								When enabled, Claude will automatically try to solve the task without asking for your
								permission. <em>Use with caution, as this may lead to unintended consequences.</em>{" "}
								<em>This feature is highly experimental and may not work as expected.</em>
							</p>
						</div>
					</div>

					{/* <div className="flex items-start space-x-2">
						<Checkbox
							id="use-udiff"
							checked={useUdiff}
							onCheckedChange={(checked) => setUseUdiff(checked as boolean)}
						/>
						<div>
							<label htmlFor="use-udiff" className="text-sm font-medium cursor-pointer">
								Use uDiffs and advance editing
							</label>
							<p className="text-xs text-muted-foreground">
								When enabled, Claude will automatically try to use uDiffs to update files instead of
								writing the entire file. <em>Use with caution, this might lead to reduced accuracy.</em>
							</p>
						</div>
					</div> */}

					<div className="flex items-start space-x-2">
						<Checkbox
							id="use-termianl-shell"
							checked={experimentalTerminal}
							onCheckedChange={(checked) => setExperimentalTerminal(checked as boolean)}
						/>
						<div>
							<label htmlFor="use-termianl-shell" className="text-sm font-medium cursor-pointer">
								Use Experimental Terminal Shell
							</label>
							<p className="text-xs text-muted-foreground">
								When enabled, Claude will be able to run shell commands in the terminal directly and
								manage your terminals. <em>Use with caution, this is experimental feature.</em>
							</p>
						</div>
					</div>

					<CustomInstructions value={customInstructions ?? ""} onChange={setCustomInstructions} />

					{IS_DEV && (
						<>
							<Separator />
							<div className="space-y-2">
								<div className="text-sm font-medium">Debug</div>
								<Button onClick={handleResetState} variant="destructive" size="sm">
									Reset State
								</Button>
								<p className="text-xs text-muted-foreground">
									This will reset all global state and secret storage in the extension.
								</p>
							</div>
						</>
					)}
				</div>
			</ScrollArea>
			<div className="text-center text-xs text-muted-foreground mt-auto pt-2">
				<p className="m-0 p-0">
					If you have any questions or feedback, feel free to open an issue at{" "}
					<a
						href="https://github.com/kodu-ai/kodu-coder"
						className="text-primary hover:underline"
						target="_blank"
						rel="noopener noreferrer">
						https://github.com/kodu-ai/kodu-coder
					</a>
				</p>
				<p className="italic m-0 p-0 mt-2">v{version}</p>
				{user?.id && <p className="m-0 p-0 mt-2">{user?.id}</p>}
			</div>
		</div>
	)
}

export default SettingsView
