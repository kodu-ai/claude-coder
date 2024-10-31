import React from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSettingsState } from "../../hooks/useSettingsState"
import { ModelDetails } from "./model-details"
import { models } from "./constants"

const PreferencesTab: React.FC = () => {
	const {
		model,
		technicalLevel,
		handleModelChange,
		handleTechnicalLevelChange,
		browserModel,
		handleBrowserModelChange,
	} = useSettingsState()

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label className="text-sm">Technical Level</Label>
				<RadioGroup
					value={technicalLevel}
					onValueChange={(v) => handleTechnicalLevelChange(v as typeof technicalLevel)}
					className="space-y-1">
					<div className="flex items-center space-x-2">
						<RadioGroupItem value="no-technical" id="no-technical" />
						<Label htmlFor="no-technical" className="text-xs">
							Non Technical
						</Label>
					</div>
					<div className="flex items-center space-x-2">
						<RadioGroupItem value="technical" id="technical" />
						<Label htmlFor="technical" className="text-xs">
							Coding Beginner
						</Label>
					</div>
					<div className="flex items-center space-x-2">
						<RadioGroupItem value="developer" id="developer" />
						<Label htmlFor="developer" className="text-xs">
							Experienced Developer
						</Label>
					</div>
				</RadioGroup>
			</div>
			<div className="space-y-2">
				<Label htmlFor="model-select" className="text-sm">
					AI Model
				</Label>
				<Select value={model} onValueChange={handleModelChange}>
					<SelectTrigger id="model-select" className="w-full">
						<SelectValue placeholder="Select a model" />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(models).map(([key, value]) => (
							<SelectItem key={key} value={key} disabled={value.disabled}>
								{value.label} {value.comingSoon && "(Coming Soon)"}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<ModelDetails model={model} />
			</div>

			<div className="space-y-2">
				<Label htmlFor="browser-model-select" className="text-sm">
					Browser Model <em className="text-xs text-muted-foreground">(used for web searches)</em>
				</Label>
				<Select value={browserModel} onValueChange={handleBrowserModelChange}>
					<SelectTrigger id="browser-model-select" className="w-full">
						<SelectValue placeholder="Select a model" />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(models).flatMap(
							([key, value]) =>
								value.isBrowserModel && (
									<SelectItem key={key} value={key} disabled={value.disabled}>
										{value.label} {value.comingSoon && "(Coming Soon)"}
									</SelectItem>
								)
						)}
					</SelectContent>
				</Select>
			</div>
		</div>
	)
}

export default PreferencesTab