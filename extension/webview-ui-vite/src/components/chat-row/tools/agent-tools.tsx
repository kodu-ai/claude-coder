import React from "react"
import { SpawnAgentTool, ExitAgentTool } from "../../../../../src/shared/new-tools"
import { ToolAddons, ToolBlock } from "../chat-tools"
import { Bot, LogOut } from "lucide-react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import MarkdownRenderer from "../markdown-renderer"

export const SpawnAgentBlock: React.FC<SpawnAgentTool & ToolAddons> = ({
	agentName,
	instructions,
	files,
	approvalState,
	tool,
	ts,
	...rest
}) => {
	files = typeof files === "string" ? files?.split(",").map((file) => file.trim()) : files

	return (
		<ToolBlock
			{...rest}
			ts={ts}
			tool={tool}
			icon={Bot}
			title="Spawn Agent"
			variant="primary"
			approvalState={approvalState}>
			<div className="flex flex-col space-y-2">
				<div className="flex items-center gap-2">
					<p className="text-xs">
						<span className="font-semibold">Agent:</span>
					</p>
					<Badge variant="outline">
						{agentName
							?.split("_")
							.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
							.join(" ")}
					</Badge>
				</div>

				<div>
					<p className="text-xs font-semibold mb-1">Instructions:</p>
					<ScrollArea className="h-24 rounded border bg-background p-2">
						<ScrollBar orientation="vertical" />
						<ScrollBar orientation="horizontal" />
						<MarkdownRenderer markdown={instructions?.trim()} />
					</ScrollArea>
				</div>

				{files && files?.length > 0 && (
					<div>
						<p className="text-xs font-semibold mb-1">Files:</p>
						<div className="flex flex-wrap gap-2">
							{files?.map((file, index) => (
								<Badge key={index} variant="secondary">
									{file}
								</Badge>
							))}
						</div>
					</div>
				)}
			</div>
		</ToolBlock>
	)
}

export const ExitAgentBlock: React.FC<ExitAgentTool & ToolAddons> = ({
	agentName,
	result,
	approvalState,
	tool,
	ts,
	...rest
}) => (
	<ToolBlock
		{...rest}
		ts={ts}
		tool={tool}
		icon={LogOut}
		title="Exit Agent"
		variant="info"
		approvalState={approvalState}>
		<div className="flex flex-col space-y-2">
			<div className="flex items-center gap-2">
				<p className="text-xs">
					<span className="font-semibold">Agent:</span> {agentName}
				</p>
				<Badge variant="outline">{agentName}</Badge>
			</div>

			<div>
				<p className="text-xs font-semibold mb-1">Result:</p>
				<ScrollArea className="h-24 rounded border bg-background p-2">
					<ScrollBar orientation="vertical" />
					<ScrollBar orientation="horizontal" />
					<MarkdownRenderer markdown={result?.trim()} />
				</ScrollArea>
			</div>
		</div>
	</ToolBlock>
)
