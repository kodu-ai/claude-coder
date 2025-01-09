import React, { FC, useState, useMemo } from "react"
import { Check, Brain, Code2, Image, ChevronsUpDown, Info, AlertTriangleIcon } from "lucide-react"

import { ModelInfo } from "extension/api/providers/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { rpcClient } from "@/lib/rpc-client"

/**
 * ModelSelector Props
 *
 * @param modelId        The currently selected model ID (string)
 * @param onChangeModel  Handler to set the new model ID when a user selects a model from the list
 * @param models         Optional record of models; defaults to koduModels
 * @param showDetails    Whether to show the selected model's details (CPM, contextWindow, output limit, badges) below the popover
 */
interface ModelSelectorProps {
	modelId?: string
	onChangeModel: ReturnType<typeof rpcClient.selectModel.useMutation>["mutate"]
	models: ModelInfo[]
	showDetails?: boolean
}

/**
 * A reusable "Select with Autocomplete" for picking a model:
 * - Clicking the button triggers a popover with a Command list
 * - Searching filters models by name + description
 * - Selecting calls `onChangeModel`
 * - Optionally displays the selected model’s info below
 */
export const ModelSelector: FC<ModelSelectorProps> = ({ modelId, onChangeModel, models, showDetails = true }) => {
	// Popover open/close state
	const [open, setOpen] = useState(false)
	// Command input state
	const [searchValue, setSearchValue] = useState("")

	// Filter models by name + description
	const filteredModels = useMemo(() => {
		const query = searchValue.toLowerCase()
		return models.filter((model) => {
			const text = model.name.toLowerCase()
			return text.includes(query)
		})
	}, [searchValue, models])

	// Currently selected model info
	const selectedModel: ModelInfo | undefined = models.find((model) => model.id === modelId)

	// Render badges for capabilities
	const renderBadges = (model: ModelInfo, renderProvider = true) => (
		<div className="flex flex-wrap gap-2">
			{renderProvider && <Badge variant="default">{model.provider}</Badge>}
			{model.supportsImages && (
				<Badge variant="secondary" className="flex items-center gap-1">
					<Image className="w-3 h-3" />
					<span className="text-xs">Vision</span>
				</Badge>
			)}

			{model.isRecommended && <Badge variant="default">Recommended</Badge>}
		</div>
	)

	return (
		<div className="space-y-4">
			{/* Title row with optional tooltips explaining terms */}
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">Pick a Model</span>

				{/* Tooltip explaining CPM, context window, output limit */}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="icon">
								<Info className="w-4 h-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent className="max-w-xs text-xs space-y-1">
							<p>
								<strong>CPM</strong>: Cost per million tokens
							</p>
							<p>
								<strong>Context Window</strong>: Maximum input size in tokens
							</p>
							<p>
								<strong>Output Limit</strong>: The max tokens the model can produce
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			{/* The Popover + Command-based autocomplete */}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button variant="outline" className="w-full justify-between text-sm">
						{selectedModel ? selectedModel.name : "Select a Model"}
						<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
					</Button>
				</PopoverTrigger>

				{/* The popover content: up to 80vw on sm: screens, max 24rem */}
				<PopoverContent className="w-full p-0">
					<Command style={{ width: "80vw", maxWidth: "400px" }}>
						<CommandInput
							placeholder="Search models..."
							value={searchValue}
							onValueChange={setSearchValue}
						/>
						<CommandList>
							<CommandEmpty>No models found.</CommandEmpty>
							<CommandGroup>
								{filteredModels.map((model) => {
									const isSelected = model.id === modelId
									return (
										<CommandItem
											key={model.id}
											onSelect={() => {
												onChangeModel({
													modelId: model.id,
													providerId: model.provider,
												})
												setOpen(false)
											}}
											className="flex flex-col items-start gap-1">
											<div className="w-full flex justify-between text-sm font-medium">
												<span>{model.name}</span>
												{isSelected && <Check className="h-4 w-4 text-primary" />}
											</div>
											{/* {model.description && (
												<span className="text-[11px] text-muted-foreground">
													{model.description}
												</span>
											)} */}

											{/* CPM, context window, output limit inline */}
											<span className="text-[11px] text-muted-foreground">
												Input: ${model.inputPrice.toFixed(2)} | Output: $
												{model.outputPrice.toFixed(2)} |{" "}
												{model.cacheWritesPrice &&
													model.cacheReadsPrice &&
													"Cache Writes: $" +
														model.cacheWritesPrice.toFixed(2) +
														" | Cache Reads: $" +
														model.cacheReadsPrice.toFixed(2) +
														" | "}
												Context: {model.contextWindow} | Output: {model.maxTokens}
											</span>
											<span className="text-[11px] text-muted-foreground">
												Prices are shown per million tokens
											</span>
											{renderBadges(model)}
										</CommandItem>
									)
								})}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			{/* If showDetails is true, display the currently selected model's detail below */}
			{showDetails && (
				<>
					<Separator />
					{selectedModel ? (
						<div className="space-y-2 text-sm">
							<div className="flex items-center justify-between">
								<span className="font-semibold">{selectedModel.name}</span>
								<Badge variant="default">{selectedModel.provider}</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								<strong>Context Window:</strong> {selectedModel.contextWindow}
								<br />
								<strong>Output Limit:</strong> {selectedModel.maxTokens}
								<br />
								<strong>Input Cost:</strong> ${selectedModel.inputPrice.toFixed(2)}
								<br />
								<strong>Output Cost:</strong> ${selectedModel.outputPrice.toFixed(2)}
								{selectedModel.cacheWritesPrice && selectedModel.cacheReadsPrice && (
									<>
										<br />
										<strong>Cache Writes Cost:</strong> ${selectedModel.cacheWritesPrice.toFixed(2)}
										<br />
										<strong>Cache Reads Cost:</strong> ${selectedModel.cacheReadsPrice.toFixed(2)}
									</>
								)}
								<br />
								<span className="text-[11px] text-muted-foreground">
									Prices are shown per million tokens
								</span>
								<br />
								{selectedModel.provider !== "kodu" && (
									<span className="text-muted-foreground text-[11px]">
										This model requires setting provider-specific settings.
									</span>
								)}
							</p>
							{renderBadges(selectedModel, false)}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">No model selected yet.</p>
					)}
				</>
			)}
		</div>
	)
}
