import React from "react"
import { useSettingsState } from "../../hooks/useSettingsState"
import { experimentalFeatures } from "./constants"
import { ExperimentalFeatureItem } from "./experimental-feature-item"

const ExperimentalTab: React.FC = () => {
	const { experimentalFeatureStates, handleExperimentalFeatureChange } = useSettingsState()

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
