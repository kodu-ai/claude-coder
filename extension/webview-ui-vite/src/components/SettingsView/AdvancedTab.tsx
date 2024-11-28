import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import React, { useEffect } from "react"
import { useSettingsState } from "../../hooks/useSettingsState"
import { ExperimentalFeatureItem } from "./experimental-feature-item"
import SystemPromptVariants from "./SystemPromptVariants"

const AdvancedTab: React.FC = () => {
	const {
		readOnly,
		autoCloseTerminal,
		autoSkipWrite,
		customInstructions,
		useDirectAnthropicApi,
		anthropicApiKey,
		handleSetReadOnly,
		handleSetAutoCloseTerminal,
		handleAutoSkipWriteChange,
		handleCustomInstructionsChange,
		handleUseDirectAnthropicApiChange,
		handleAnthropicApiKeyChange,
	} = useSettingsState()

	return (
		<div className="space-y-6">
			<div className="space-y-4">
				<ExperimentalFeatureItem
					feature={{
						id: "useDirectAnthropicApi",
						label: "Use Direct Anthropic API",
						description: "Use Anthropic API directly instead of Kodu (some features like image generation and web search will be disabled)",
					}}
					checked={useDirectAnthropicApi}
					onCheckedChange={handleUseDirectAnthropicApiChange}
				/>
				
				{useDirectAnthropicApi && (
					<div className="space-y-2 pl-4">
						<Label htmlFor="anthropic-api-key" className="text-xs font-medium">
							Anthropic API Key
						</Label>
						<Input
							id="anthropic-api-key"
							type="password"
							placeholder="sk-ant-..."
							value={anthropicApiKey}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAnthropicApiKeyChange(e.target.value)}
							className="text-xs"
						/>
					</div>
				)}

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
			</div>

			<div className="space-y-2">
				<Label htmlFor="custom-instructions" className="text-xs font-medium">
					Custom Instructions
				</Label>
				<Textarea
					id="custom-instructions"
					placeholder="e.g. 'Run unit tests at the end', 'Use TypeScript with async/await'"
					value={customInstructions}
					onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleCustomInstructionsChange(e.target.value)}
					className="min-h-[60px] text-xs"
				/>
			</div>

			<SystemPromptVariants />
		</div>
	)
}

export default AdvancedTab
