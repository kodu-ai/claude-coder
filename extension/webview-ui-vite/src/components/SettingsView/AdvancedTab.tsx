import React from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSettingsState } from "../../hooks/useSettingsState"
import { ExperimentalFeatureItem } from "./experimental-feature-item"
import SystemPromptVariants from "./SystemPromptVariants"

const AdvancedTab: React.FC = () => {
	const {
		readOnly,
		autoCloseTerminal,
		autoSkipWrite,
		customInstructions,
		handleSetReadOnly,
		handleSetAutoCloseTerminal,
		handleAutoSkipWriteChange,
		setCustomInstructions,
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
			</div>
			<SystemPromptVariants />
		</div>
	)
}

export default AdvancedTab
