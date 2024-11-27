import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import React, { useEffect } from "react"
import { useSettingsState } from "../../hooks/useSettingsState"
import { ExperimentalFeatureItem } from "./experimental-feature-item"
import SystemPromptVariants from "./SystemPromptVariants"
import { Slider } from "../ui/slider"

const AdvancedTab: React.FC = () => {
	const {
		readOnly,
		autoCloseTerminal,
		autoSkipWrite,
		customInstructions,
		terminalCompressionThreshold,
		handleTerminalCompressionThresholdChange,
		handleSetReadOnly,
		handleSetAutoCloseTerminal,
		handleAutoSkipWriteChange,
		handleCustomInstructionsChange,
	} = useSettingsState()

	return (
		<div className="space-y-6">
			<div className="space-y-4">
				<ExperimentalFeatureItem
					feature={{
						id: "alwaysAllowReadOnly",
						label: "Always Allow Read-Only Operations",
						description: "Automatically read files and view directories without requiring permission",
					}}
					checked={readOnly}
					onCheckedChange={handleSetReadOnly}
				/>
				<ExperimentalFeatureItem
					feature={{
						id: "autoCloseTerminal",
						label: "Automatically close terminal",
						description: "Automatically close the terminal after executing a command",
					}}
					checked={autoCloseTerminal}
					onCheckedChange={handleSetAutoCloseTerminal}
				/>
				<ExperimentalFeatureItem
					feature={{
						id: "skipWriteAnimation",
						label: "Automatically skip file write animation",
						description:
							"Automatically skip the file write animation when saving files *good for low-end machines*",
					}}
					checked={autoSkipWrite}
					onCheckedChange={handleAutoSkipWriteChange}
				/>
				<div className="space-y-4 mx-0">
					<ExperimentalFeatureItem
						feature={{
							id: "terminalCompressionThreshold",
							label: "Enable Terminal Compression",
							description:
								"Compress terminal output to reduce token usage when the output exceeds the threshold",
						}}
						checked={terminalCompressionThreshold !== undefined}
						onCheckedChange={(checked) =>
							handleTerminalCompressionThresholdChange(checked ? 10000 : undefined)
						}
					/>
					{terminalCompressionThreshold !== undefined && (
						<div className="pl-0 grid gap-4">
							<div className="grid gap-2">
								<Label htmlFor="range">Compression Threshold</Label>
								<div className="grid gap-4">
									<div className="flex items-center gap-4">
										<Input
											id="range"
											type="number"
											value={terminalCompressionThreshold}
											onChange={(e) => {
												const value = parseInt(e.target.value)
												if (!isNaN(value)) {
													handleTerminalCompressionThresholdChange(
														Math.min(Math.max(value, 2000), 200000)
													)
												}
											}}
											min={2000}
											max={200000}
											step={1000}
											className="w-24"
										/>
										<span className="text-sm text-muted-foreground">(2,000 - 200,000)</span>
									</div>
									<Slider
										min={2000}
										max={200000}
										step={1000}
										value={[terminalCompressionThreshold]}
										onValueChange={(value) => handleTerminalCompressionThresholdChange(value[0])}
										className="w-full"
									/>
								</div>
								<p className="text-sm text-muted-foreground">
									Adjust the token threshold at which terminal output will be compressed
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			<div className="space-y-2">
				<Label htmlFor="custom-instructions" className="text-xs font-medium">
					Custom Instructions
				</Label>
				<Textarea
					id="custom-instructions"
					placeholder="e.g. 'Run unit tests at the end', 'Use TypeScript with async/await'"
					value={customInstructions}
					onChange={(e) => handleCustomInstructionsChange(e.target.value)}
					className="min-h-[60px] text-xs"
				/>
			</div>

			<SystemPromptVariants />
		</div>
	)
}

export default AdvancedTab
