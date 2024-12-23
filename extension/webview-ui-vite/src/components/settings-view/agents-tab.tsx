import React, { useState, useCallback } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { useAtom } from "jotai"
import { useExtensionState } from "@/context/extension-state-context"
import { vscode } from "@/utils/vscode"
import _ from "lodash"
import { Badge } from "../ui/badge"

const AgentsTab: React.FC = () => {
	const [subTaskEnabled, setSubTaskEnabled] = useState(false)
	const [coderEnabled, setCoderEnabled] = useState(false)
	const { observerHookEvery, setObserverHookEvery } = useExtensionState()
	const observerEnabled = !!(observerHookEvery ?? 0 > 0)

	// Create a debounced version of the vscode message sender
	const debouncedVSCodeUpdate = useCallback(
		_.debounce((value?: number) => {
			vscode.postMessage({ type: "enableObserverHook", triggerEvery: value })
		}, 300),
		[] // Empty dependency array since we don't want to recreate the debounced function
	)

	const setObserverFrequency = (value?: number) => {
		// Immediately update UI
		setObserverHookEvery(value)
		// Debounce the vscode update
		debouncedVSCodeUpdate(value)
	}

	const setObserverEnabled = (enabled: boolean) => {
		if (enabled) {
			setObserverFrequency(1)
		} else {
			setObserverFrequency(undefined)
		}
	}

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="text-sm">Sub Task Agent</CardTitle>
						<Badge>Enabled</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<CardDescription className="text-xs">
						Let's kodu spawn a sequentual agent with isolated context only for a specifc task passing back
						and the final information to Kodu main thread
					</CardDescription>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="text-sm">Observer Agent</CardTitle>
						<Switch
							checked={observerEnabled}
							onCheckedChange={setObserverEnabled}
							aria-label="Toggle observer agent"
						/>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<CardDescription className="text-xs">
						Spawns an observer agent that watches Kodu steps and passively comments and inject useful
						information back as a user message, this let's Kodu auto correct it's trajectory, the agent
						returns the action, reward and explanition
					</CardDescription>
					{observerHookEvery && (
						<div className="space-y-2">
							<Label className="text-xs">Observer Frequency (messages)</Label>
							<Slider
								value={[observerHookEvery]}
								onValueChange={(value) => setObserverFrequency(value[0])}
								min={1}
								max={10}
								step={1}
								className="w-full"
							/>
							<div className="text-xs text-muted-foreground">
								Current: Every {observerHookEvery} message{observerHookEvery > 1 ? "s" : ""}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="text-sm">Coder Agent</CardTitle>
						<Badge>Early Testing</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<CardDescription className="text-xs">
						Switches Kodu to act as an architecture mode where it primary goal is to create a solution and
						gather knowledge while leaving the complex editing logic to a seperate agent with isolated
						context and tools to only perform code edits
					</CardDescription>
				</CardContent>
			</Card>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div>
							<Button className="w-full" disabled>
								Create Your Agent
							</Button>
						</div>
					</TooltipTrigger>
					<TooltipContent side="top">
						<p className="text-xs">Coming Soon</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	)
}

export default AgentsTab
