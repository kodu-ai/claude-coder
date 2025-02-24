import React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import _ from "lodash"
import { Badge } from "../../ui/badge"
import { ObserverAgentCard } from "./observer-agent-card"

const AgentsTab: React.FC = () => {
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

			<ObserverAgentCard />

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
