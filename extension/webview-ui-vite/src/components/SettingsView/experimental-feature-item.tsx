import React from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import { GlobalState } from "../../../../src/providers/claude-coder/state/GlobalStateManager"

interface ExperimentalFeature {
	id: keyof GlobalState
	label: string
	description: string
	disabled?: boolean
	comingSoon?: boolean
}

interface ExperimentalFeatureItemProps {
	feature: ExperimentalFeature
	checked: boolean
	onCheckedChange: (checked: boolean) => void
}

export const ExperimentalFeatureItem: React.FC<ExperimentalFeatureItemProps> = React.memo(
	({ feature, checked, onCheckedChange }) => (
		<div className="flex items-center justify-between">
			<div className="flex-1 pr-2">
				<Label htmlFor={feature.id} className="text-xs font-medium flex items-center">
					{feature.label}
				</Label>
				<p className="text-[10px] text-muted-foreground">{feature.description}</p>
			</div>
			{feature.comingSoon ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="ml-1 text-[10px] bg-secondary text-secondary-foreground px-1 py-0.5 rounded cursor-pointer">
							BETA
						</span>
					</TooltipTrigger>
					<TooltipContent align="end">
						<div className="max-w-[80vw] w-full">
							<pre className="whitespace-pre-line">
								This feature is currently in closed beta, if you would like to participate please
								contact us via discord.
							</pre>
						</div>
					</TooltipContent>
				</Tooltip>
			) : (
				<Switch
					id={feature.id}
					checked={checked}
					onCheckedChange={onCheckedChange}
					disabled={feature.disabled}
				/>
			)}
		</div>
	)
)
