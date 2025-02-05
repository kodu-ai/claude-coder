import React from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { ToolName } from "../../../../src/agent/v1/tools/types"
import { ToolPromptSchema } from "../../../../src/agent/v1/prompts/utils/utils"
import { toolPrompts } from "../../../../src/agent/v1/prompts/tools"
import { currentPromptContentAtom, disabledToolsAtom, isCurrentPreviewAtom, tools } from "./utils"
import { useAtom, useAtomValue } from "jotai"
import { useEvent } from "react-use"
import { ExtensionMessage } from "../../../../src/shared/messages/extension-message"
import { vscode } from "@/utils/vscode"
import { PromptActions } from "./prompt-actions"

/**
 *
 * @param toolName something_like_this
 * @returns Something Like This
 */
const toolNamePrettier = (toolName: ToolName) => {
	return toolName
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
}

export const ToolCards = () => {
	const [disabledTools, setDisabledTools] = useAtom(disabledToolsAtom)
	const currentPromptContent = useAtomValue(currentPromptContentAtom)
	const isCurrentPreview = useAtomValue(isCurrentPreviewAtom)

	useEvent("message", (event) => {
		const message = event.data as ExtensionMessage
		if (message.type === "disabledTools") {
			setDisabledTools(new Set(message.tools))
		}
	})

	console.log("tools", tools)

	return (
		<ScrollArea className="h-[400px] w-full rounded-md border">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
				{Object.entries(tools).map(([name, schema]) => (
					<Card key={name} className="relative">
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<CardTitle className="text-lg">{toolNamePrettier(name as ToolName)}</CardTitle>
								<Switch
									checked={!disabledTools.has(name as ToolName)}
									onCheckedChange={(e) =>
										vscode.postMessage({
											type: "disableTool",
											toolName: name as ToolName,
											boolean: e,
											content: isCurrentPreview ? currentPromptContent : "",
										})
									}
								/>
							</div>
							<CardDescription className="line-clamp-4">{schema.description}</CardDescription>
						</CardHeader>
						{/* <CardContent>
							<div className="flex flex-wrap gap-1">
								{schema.capabilities.map((cap, i) => (
									<Badge key={i} variant="secondary" className="text-xs">
										{cap}
									</Badge>
								))}
							</div>
						</CardContent> */}
					</Card>
				))}
			</div>
		</ScrollArea>
	)
}

export default ToolCards
