import React from "react"
import { useSettingsState } from "../../hooks/useSettingsState"
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
			<div className="flex items-center gap-4">
				<Label htmlFor="editing-type" className="text-sm font-medium">
					Inline Editing Type
				</Label>
				<Select value={inlineEditingType} onValueChange={handleInlineEditingTypeChange}>
					<SelectTrigger id="editing-type" className="w-32">
						<SelectValue placeholder="Select type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="full">Full</SelectItem>
						<SelectItem value="diff">Diff</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>
	)
}

export default ExperimentalTab
