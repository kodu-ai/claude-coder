import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, Globe, Search } from "lucide-react"
import React, { useEffect, useState } from "react"

import { ToolAddons, ToolBlock, ToolStatus } from "../ToolRenderV1"

import {
	AskConsultantTool,
	AskFollowupQuestionTool,
	AttemptCompletionTool,
	ChatTool,
	ExecuteCommandTool,
	ListCodeDefinitionNamesTool,
	ListFilesTool,
	ReadFileTool,
	SearchFilesTool,
	ServerRunnerTool,
	UpsertMemoryTool,
	UrlScreenshotTool,
	WriteToFileTool,
	WebSearchTool,
} from "../../../../../src/shared/new-tools"

type EnhancedWebSearchBlockProps = WebSearchTool & ToolAddons

export const EnhancedWebSearchBlock: React.FC<EnhancedWebSearchBlockProps> = ({
	searchQuery,
	baseLink,
	browserModel,
	content,
	streamType,
	approvalState,
	onApprove,
	onReject,
	ts,
}) => {
	const [currentStep, setCurrentStep] = useState("Initializing request")
	const [searchContent, setSearchContent] = useState("")

	useEffect(() => {
		if (approvalState === "loading") {
			const steps = ["Setting up the stream", "Analyzing query", "Fetching results", "Summarizing findings"]
			let currentStepIndex = 0

			const interval = setInterval(() => {
				setCurrentStep(steps[currentStepIndex])
				currentStepIndex = (currentStepIndex + 1) % steps.length
			}, 3000)

			return () => clearInterval(interval)
		}
	}, [approvalState])

	useEffect(() => {
		if (content) {
			setSearchContent(content)
		}
	}, [content])

	const renderContent = () => {
		if (approvalState === "loading" && searchContent.length > 0) {
			return (
				<div className="flex items-center space-x-2 text-primary animate-pulse">
					<Search className="w-4 h-4" />
					<span className="text-sm">{searchContent}</span>
				</div>
			)
		}

		if (approvalState === "approved" && searchContent) {
			return (
				<ScrollArea className="h-[200px] w-full rounded-md border mt-2">
					<div className="p-4">
						<h4 className="text-sm font-semibold mb-2">Search Results:</h4>
						<pre className="text-sm whitespace-pre-wrap">{searchContent}</pre>
					</div>
				</ScrollArea>
			)
		}

		return null
	}

	return (
		<ToolBlock
			tool="web_search"
			icon={Globe}
			title={approvalState === "loading" ? `Web Search` : "Web Search"}
			variant={approvalState === "approved" ? "success" : "info"}
			approvalState={approvalState}
			onApprove={onApprove}
			onReject={onReject}
			ts={ts}>
			<div className="text-xs flex flex-col gap-2">
				<p>
					<span className="font-semibold">Search query:</span> "{searchQuery}"
				</p>
				{baseLink && (
					<p>
						<span className="font-semibold">Starting from:</span>{" "}
						<a href={baseLink} target="_blank" rel="noopener noreferrer" className="text-primary">
							{baseLink}
						</a>
					</p>
				)}
				{browserModel && (
					<p>
						<span className="font-semibold">Browser model:</span>{" "}
						{browserModel === "fast" ? "Claude 3.5 Haiku" : "Claude 3.5 Sonnet"}
					</p>
				)}
			</div>
			{renderContent()}
			{approvalState === "approved" && searchContent && (
				<div className="mt-2 text-sm text-success">Search completed successfully.</div>
			)}
			{approvalState === "error" && (
				<div className="mt-2 text-sm text-destructive">
					<AlertCircle className="w-4 h-4 inline-block mr-1" />
					An error occurred during the search.
				</div>
			)}
		</ToolBlock>
	)
}
