"use client"

import React, { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Check, Brain, Code2, Image, ChevronsUpDown } from "lucide-react"

import { koduModels, ModelInfo } from "../../../../../src/shared/api"
import { useSettingsState } from "../../../hooks/use-settings-state"
import { ModelSelector } from "./model-picker"
import CustomProvider from "./custom-provider"

/**
 * PreferencesTab
 * A "Select with Autocomplete" using Popover + Command, now with contextWindow + maxTokens.
 */
const PreferencesTabNew: React.FC = () => {
	const { model: selectedModelId, handleModelChange } = useSettingsState()
	const [isCustomModel, setIsCustomModel] = useState(false)
	return (
		<Card className="max-w-md w-full mx-auto">
			<CardHeader>
				<CardTitle className="text-base sm:text-lg">Main Architecture Model</CardTitle>
				<CardDescription className="text-sm">Choose your default code-completion model</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Popover-based select with autocomplete */}
				{isCustomModel ? (
					<CustomProvider />
				) : (
					<ModelSelector modelId={selectedModelId} onChangeModel={handleModelChange} showDetails={true} />
				)}
			</CardContent>

			<CardFooter className="text-xs text-muted-foreground flex flex-col items-start gap-0">
				<span>Agent-specific models can be configured in the Agents tab.</span>
				<br />
				<span>
					{isCustomModel ? "Want to use a custom model? " : "Want to use Kodu models (Recommended)? "}
					<button
						onClick={() => setIsCustomModel((prev) => !prev)}
						className="hover:underline text-primary transition-all">
						click here
					</button>
				</span>
			</CardFooter>
		</Card>
	)
}

export default PreferencesTabNew
