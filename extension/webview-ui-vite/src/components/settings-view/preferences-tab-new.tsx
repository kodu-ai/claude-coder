// "use client"

// import React, { useState, useMemo } from "react"
// import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
// import { Badge } from "@/components/ui/badge"
// import { Separator } from "@/components/ui/separator"
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
// import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
// import { Button } from "@/components/ui/button"
// import { Check, Brain, Code2, Image, ChevronsUpDown } from "lucide-react"

// import { koduModels, ModelInfo } from "../../../../src/shared/api"
// import { useSettingsState } from "../../hooks/use-settings-state"
// import { ModelSelector } from "./model-picker"

// /**
//  * PreferencesTab
//  * A "Select with Autocomplete" using Popover + Command, now with contextWindow + maxTokens.
//  */
// const PreferencesTab: React.FC = () => {
// 	const { model: selectedModelId, handleModelChange } = useSettingsState()

// 	// Convert our models object into an array
// 	const allModels = useMemo(
// 		() =>
// 			Object.entries(koduModels).map(([id, info]) => ({
// 				id,
// 				...info,
// 			})),
// 		[]
// 	)

// 	// We'll track popover state here
// 	const [open, setOpen] = useState(false)
// 	// And track user input in the Command
// 	const [searchValue, setSearchValue] = useState("")

// 	// Filter models by label + description
// 	const filteredModels = useMemo(() => {
// 		const query = searchValue.toLowerCase()
// 		return allModels.filter(({ label, description }) => {
// 			const combined = (label + (description ?? "")).toLowerCase()
// 			return combined.includes(query)
// 		})
// 	}, [searchValue, allModels])

// 	// The currently selected model info, if any
// 	const selectedModel: ModelInfo | undefined = koduModels[selectedModelId]

// 	// Helper to show badges
// 	const renderCapabilities = (model: ModelInfo) => (
// 		<div className="flex flex-wrap gap-1 mt-1">
// 			{model.capabilities?.vision && (
// 				<Badge variant="secondary" className="flex items-center gap-1">
// 					<Image className="w-3 h-3" />
// 					<span className="text-xs">Vision</span>
// 				</Badge>
// 			)}
// 			{model.capabilities?.reasoning && (
// 				<Badge variant="secondary" className="flex items-center gap-1">
// 					<Brain className="w-3 h-3" />
// 					<span className="text-xs">Reasoning</span>
// 				</Badge>
// 			)}
// 			{model.capabilities?.coding && (
// 				<Badge variant="secondary" className="flex items-center gap-1">
// 					<Code2 className="w-3 h-3" />
// 					<span className="text-xs">Coding</span>
// 				</Badge>
// 			)}
// 			{model.isRecommended && <Badge variant="default">Recommended</Badge>}
// 		</div>
// 	)

// 	return (
// 		<Card className="max-w-md w-full mx-auto">
// 			<CardHeader>
// 				<CardTitle className="text-base sm:text-lg">Main Architecture Model</CardTitle>
// 				<CardDescription className="text-sm">Choose your default code-completion model</CardDescription>
// 			</CardHeader>

// 			<CardContent className="space-y-4">
// 				{/* Popover-based select with autocomplete */}
// 				<ModelSelector modelId={selectedModelId} onChangeModel={handleModelChange} showDetails={true} />
// 			</CardContent>

// 			<CardFooter className="text-xs text-muted-foreground">
// 				Agent-specific models can be configured in the Agents tab.
// 			</CardFooter>
// 		</Card>
// 	)
// }

// export default PreferencesTab
