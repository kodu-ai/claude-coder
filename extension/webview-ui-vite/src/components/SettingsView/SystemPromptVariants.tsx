import React from "react"
import { Label } from "@/components/ui/label"
import { Power } from "lucide-react"
import { useSettingsState } from "../../hooks/useSettingsState"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "../ui/scroll-area"

const systemVariables = [
	{
		name: "cwd",
		label: "Current Directory",
		description: "The current working directory where commands will be executed",
	},
	{
		name: "tools",
		label: "Available Tools",
		description: "List of all available tools that can be used to accomplish tasks",
	},
	{
		name: "technicalLevel",
		label: "Technical Level",
		description: "The user's technical expertise level (no-technical, technical, or developer)",
	},
	{
		name: "sysInfo",
		label: "System Info",
		description: "Information about the user's operating system and environment",
	},
]

const SystemPromptVariants: React.FC = () => {
	const { systemPromptVariants, handleSetActiveVariant, activeVariantId } = useSettingsState()

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">Choose your System Prompt Variant</Label>
			</div>

			<Accordion type="single" collapsible className="space-y-2">
				{systemPromptVariants?.map((variant) => (
					<AccordionItem key={variant.id} value={variant.id} className="border rounded-lg">
						<AccordionTrigger className="px-4 py-2 hover:no-underline">
							<div className="flex items-center justify-between w-full">
								<div className="flex items-center gap-2">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium">{variant.name}</span>
										{activeVariantId === variant.id && (
											<Badge variant="secondary" className="text-xs">
												Active
											</Badge>
										)}
									</div>
								</div>
								<div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
									<Button
										variant={activeVariantId === variant.id ? "secondary" : "ghost"}
										size="icon"
										onClick={() => handleSetActiveVariant(variant.id)}
										className="relative">
										<Power className="h-4 w-4" />
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="sr-only">
														{activeVariantId === variant.id
															? "Active Variant"
															: "Set as Active"}
													</span>
												</TooltipTrigger>
												<TooltipContent>
													<p>
														{activeVariantId === variant.id
															? "Active Variant"
															: "Set as Active"}
													</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</Button>
								</div>
							</div>
						</AccordionTrigger>
						<AccordionContent className="px-4 pb-2">
							<div className="text-xs font-mono bg-muted px-2 rounded-md">
								<ScrollArea
									viewProps={{
										className: "max-h-[240px]",
									}}>
									<pre className="whitespace-pre-wrap">{variant.content}</pre>
									<ScrollBar />
								</ScrollArea>
							</div>
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	)
}

export default SystemPromptVariants
