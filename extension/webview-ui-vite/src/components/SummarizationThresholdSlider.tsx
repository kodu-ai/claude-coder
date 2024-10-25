import { cn } from '@/lib/utils'
import { vscode } from '../utils/vscode'
import { Label } from './ui/label'
import { Slider } from './ui/slider'

interface SummarizationThresholdSliderProps {
	summarizationThreshold: number
	setSummarizationThreshold: (threshold: number) => void
	className?: string
}

export default function SummarizationThresholdSlider({
	summarizationThreshold,
	setSummarizationThreshold,
	className,
}: SummarizationThresholdSliderProps) {
	const handleThresholdChange = (value: number[]) => {
		const newThreshold = value[0]
		setSummarizationThreshold(newThreshold)
		// vscode.postMessage({ type: 'setSummarizationThreshold', value: newThreshold })
	}

	return (
		<div className={cn('flex flex-col space-y-2', className)}>
			<div className="flex justify-between items-center">
				<Label htmlFor="threshold-slider" className="text-sm font-medium">
					Summarization Threshold
				</Label>
				<span className="text-sm font-semibold">{summarizationThreshold}%</span>
			</div>
			<Slider
				id="threshold-slider"
				min={20}
				max={80}
				step={1}
				value={[summarizationThreshold]}
				onValueChange={handleThresholdChange}
				className="w-full"
			/>
			<p className="text-xs text-muted-foreground">
				Adjust when Claude should offer to summarize the conversation in order to save tokens.
			</p>
		</div>
	)
}
