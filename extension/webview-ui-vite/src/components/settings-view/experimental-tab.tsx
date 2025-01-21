import React from "react"
import { useSettingsState } from "../../hooks/use-settings-state"
import { experimentalFeatures } from "./constants"
import { ExperimentalFeatureItem } from "./experimental-feature-item"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

const ExperimentalTab: React.FC = () => {
	const {
		experimentalFeatureStates,
		handleExperimentalFeatureChange,
		handleInlineEditingTypeChange,
		inlineEditingType,
	} = useSettingsState()

	return (
		<div className="space-y-4">
			{experimentalFeatures.map((feature) => (
				<ExperimentalFeatureItem
					key={feature.id}
					feature={feature}
					checked={experimentalFeatureStates[feature.id as keyof typeof experimentalFeatureStates]}
					onCheckedChange={(checked) => handleExperimentalFeatureChange(feature.id, checked)}
				/>
			))}
		</div>
	)
}

export default ExperimentalTab
