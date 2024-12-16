import React from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Check, X } from "lucide-react"
import { KoduModels } from "../../../../src/shared/api"
import { models } from "./constants"

interface ModelDetailsProps {
	model: keyof KoduModels
}

export const ModelDetails: React.FC<ModelDetailsProps> = React.memo(({ model }) => {
	const details = models[model]
	if (!details || details.comingSoon) return null

	return (
		<Collapsible defaultOpen className="w-full">
			<CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs font-medium">
				Model Specifications
				<ChevronDown className="h-3 w-3" />
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-2 text-xs">
				<div className="grid grid-cols-1 gap-1">
					<div>Max Tokens: {details.maxTokens?.toLocaleString()}</div>
					<div>Context Window: {details.contextWindow?.toLocaleString()}</div>
					<div>
						Supports Images:{" "}
						{details.supportsImages ? (
							<Check className="inline text-green-500 h-3 w-3" />
						) : (
							<X className="inline text-red-500 h-3 w-3" />
						)}
					</div>
					<div>
						Supports Prompt Cache:{" "}
						{details.supportsPromptCache ? (
							<Check className="inline text-green-500 h-3 w-3" />
						) : (
							<X className="inline text-red-500 h-3 w-3" />
						)}
					</div>
				</div>

				<div className="flex flex-wrap gap-1 mt-2">
					{details.isRecommended && (
						<span className="px-2 py-1 bg-secondary text-secondary-foreground text-[11px] rounded-full">
							Recommended
						</span>
					)}
					{details.isHardWorker && (
						<span className="px-2 py-1 bg-secondary text-secondary-foreground text-[11px] rounded-full">
							Hard Worker
						</span>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
})
