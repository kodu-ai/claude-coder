"use client"

import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

import { useSettingsState } from "../../../hooks/use-settings-state"
import { ModelSelector } from "./model-picker"
import { rpcClient } from "@/lib/rpc-client"
import ProviderManager from "./provider-manager"

/**
 * PreferencesTab
 * A "Select with Autocomplete" using Popover + Command, now with contextWindow + maxTokens.
 */
const PreferencesTabNew: React.FC = () => {
	// const { model: selectedModelId, handleModelChange } = useSettingsState()
	const { data: { modelId: selectedModelId } = { modelId: "" }, refetch } = rpcClient.currentModel.useQuery({})
	const { mutate: handleModelChange } = rpcClient.selectModel.useMutation({
		onSuccess: () => {
			refetch()
		},
	})
	const [isCustomModel, setIsCustomModel] = useState(false)
	const { data, status } = rpcClient.listModels.useQuery(
		{},
		{
			refetchInterval: 5000,
			refetchOnWindowFocus: true,
		}
	)

	if (!data) return null
	return (
		<Card className="max-w-md w-full mx-auto">
			<CardHeader>
				<CardTitle className="text-base sm:text-lg">Main Architecture Model</CardTitle>
				<CardDescription className="text-sm">Choose your default code-completion model</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Popover-based select with autocomplete */}
				{isCustomModel ? (
					<ProviderManager />
				) : (
					<ModelSelector
						models={data.models ?? []}
						modelId={selectedModelId}
						onChangeModel={handleModelChange}
						showDetails={true}
					/>
				)}
			</CardContent>

			<CardFooter className="text-xs text-muted-foreground flex flex-col items-start gap-0">
				<span>Agent-specific models can be configured in the Agents tab.</span>
				<br />
				<span>
					{!isCustomModel ? "Want to use a custom provider? " : "Want to select models from the list? "}
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
