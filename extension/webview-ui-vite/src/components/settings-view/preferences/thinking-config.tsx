import React, { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { rpcClient } from "@/lib/rpc-client"

// Define min and max token budget
const MIN_BUDGET = 100
const MAX_BUDGET = 64000
const DEFAULT_BUDGET = 10000

type ThinkingConfig = {
	type?: "enabled" | undefined
	budget_tokens?: undefined | number
}

interface ThinkingConfigComponentProps {
	modelId: string | undefined
}

export const ThinkingConfigComponent: React.FC<ThinkingConfigComponentProps> = ({ modelId }) => {
	const [thinking, setThinking] = useState<ThinkingConfig>({})

	// Fetch initial thinking config
	const { data: thinkingConfig } = rpcClient.getGlobalState.useQuery(
		{ key: "thinking" },
		{
			refetchOnWindowFocus: false,
		}
	)

	useEffect(() => {
		if (thinkingConfig) {
			setThinking(thinkingConfig as ThinkingConfig)
		}
	}, [thinkingConfig])

	const { mutate: updateGlobalState } = rpcClient.updateGlobalState.useMutation({
		onSuccess: () => {
			console.log("Thinking config updated successfully")
		},
		onError: (error) => {
			console.error("Error updating thinking config:", error)
		},
	})

	const updateThinkingConfig = async (newConfig: Partial<ThinkingConfig>) => {
		const updatedConfig = { ...thinking, ...newConfig }
		updateGlobalState({
			key: "thinking",
			value: updatedConfig,
		})
		setThinking(updatedConfig)
	}

	// Handle toggle of thinking feature
	const handleToggleThinking = (enabled: boolean) => {
		if (enabled) {
			updateThinkingConfig({
				type: "enabled",
				budget_tokens: thinking.budget_tokens || DEFAULT_BUDGET,
			})
		} else {
			updateThinkingConfig({
				type: undefined,
				budget_tokens: undefined,
			})
		}
	}

	// Handle slider change
	const handleSliderChange = (value: number[]) => {
		updateThinkingConfig({ budget_tokens: value[0] })
	}

	// Only show for claude-3-7-sonnet-20250219 model
	if (modelId !== "claude-3-7-sonnet-20250219") {
		return null
	}

	const isEnabled = thinking.type === "enabled"
	const currentBudget = thinking.budget_tokens || DEFAULT_BUDGET

	return (
		<Card className="mt-4">
			<CardHeader>
				<CardTitle className="text-base">Model Thinking Configuration</CardTitle>
				<CardDescription className="text-sm">
					Configure thinking parameters for Claude Sonnet 3.7 model
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="flex items-center justify-between">
					<Label htmlFor="thinking-enabled" className="flex flex-col gap-1">
						<span>Enable Thinking</span>
						<span className="text-muted-foreground text-xs">
							Allow the model to engage in reflective thinking
						</span>
					</Label>
					<Switch id="thinking-enabled" checked={isEnabled} onCheckedChange={handleToggleThinking} />
				</div>

				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<Label htmlFor="budget-tokens">Thinking Budget (tokens)</Label>
						<span className="text-sm font-medium">
							{isEnabled ? currentBudget.toLocaleString() : "Disabled"}
						</span>
					</div>
					<Slider
						id="budget-tokens"
						disabled={!isEnabled}
						min={MIN_BUDGET}
						max={MAX_BUDGET}
						step={100}
						value={[currentBudget]}
						onValueChange={handleSliderChange}
					/>
					<p className="text-xs text-muted-foreground">
						Adjust the slider to set the token budget for thinking (range: {MIN_BUDGET.toLocaleString()} -{" "}
						{MAX_BUDGET.toLocaleString()} tokens)
					</p>
				</div>
			</CardContent>
		</Card>
	)
}
