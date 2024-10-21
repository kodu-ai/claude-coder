import React from 'react'
import { vscode } from '../utils/vscode'
import { Label } from './ui/label'
import { Slider } from './ui/slider'

interface SummarizationThresholdSliderProps {
	summarizationThreshold: number
	setSummarizationThreshold: (threshold: number) => void
}

const SummarizationThresholdSlider: React.FC<SummarizationThresholdSliderProps> = ({
	summarizationThreshold,
	setSummarizationThreshold
}) => {
	const handleThresholdChange = (value: number[]) => {
		const newThreshold = value[0]
		setSummarizationThreshold(newThreshold)
		vscode.postMessage({ type: 'setSummarizationThreshold', value: newThreshold })
	}

	return (
		<div className="flex flex-col space-y-2">
			<Label htmlFor="threshold-slider" className="text-sm font-medium">
				Summarization Threshold: {summarizationThreshold}%
			</Label>
			<Slider
				id="threshold-slider"
				min={20}
				max={80}
				step={1}
				value={[summarizationThreshold]}
				onValueChange={handleThresholdChange}
				className="w-full px-2"
			/>
			<p className="text-xs text-muted-foreground">
				Adjust when Claude should offer to summarize the conversation in order to save tokens.
			</p>
		</div>
	)
}

export default SummarizationThresholdSlider
