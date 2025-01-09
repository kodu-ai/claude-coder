/* eslint-disable @typescript-eslint/no-unused-vars */
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
	AlertCircle,
	Bot,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	ClipboardCheck,
	Code,
	FileText,
	FolderTree,
	HelpCircle,
	Image,
	LoaderPinwheel,
	LogOut,
	MessageCircle,
	MessageCircleReply,
	Play,
	RefreshCw,
	Scissors,
	Search,
	Server,
	Square,
	Terminal,
	XCircle,
} from "lucide-react"
import React, { useMemo, useState } from "react"
import {
	AddInterestedFileTool,
	AskFollowupQuestionTool,
	AttemptCompletionTool,
	ChatTool,
	ExecuteCommandTool,
	ExploreRepoFolderTool,
	FileChangePlanTool,
	ListFilesTool,
	ReadFileTool,
	SearchFilesTool,
	SearchSymbolsTool,
	ServerRunnerTool,
	UrlScreenshotTool,
	SubmitReviewTool,
} from "../../../../src/shared/new-tools"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { ScrollArea, ScrollBar } from "../ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { EnhancedWebSearchBlock } from "./tools/web-search-tool"
import { FileEditorTool } from "./tools/file-editor-tool"
import { SpawnAgentBlock, ExitAgentBlock } from "./tools/agent-tools"
import MarkdownRenderer from "./markdown-renderer"
import { CodeBlock } from "./code-block"
import { getLanguageFromPath } from "@/utils/get-language-from-path"

type ApprovalState = ToolStatus
export type ToolAddons = {
	approvalState?: ApprovalState
	ts: number
	/**
	 * If this is a sub message, it will force it to stick to previous tool call in the ui (same message)
	 */
	isSubMsg?: boolean
	userFeedback?: string
}
type ToolBlockProps = {
	icon: React.FC<React.SVGProps<SVGSVGElement>>
	title: string
	children: React.ReactNode
	tool: ChatTool["tool"]
	variant: "default" | "primary" | "info" | "accent" | "info" | "success" | "info" | "destructive"
} & ToolAddons

export const ToolBlock: React.FC<ToolBlockProps> = ({
	icon: Icon,
	title,
	children,
	variant,
	isSubMsg,
	approvalState,
	userFeedback,
}) => {
	variant =
		approvalState === "loading"
			? "info"
			: approvalState === "error" || approvalState === "rejected"
			? "destructive"
			: approvalState === "approved"
			? "success"
			: variant
	const stateIcons = {
		pending: <AlertCircle className="w-5 h-5 text-info" />,
		approved: <CheckCircle className="w-5 h-5 text-success" />,
		rejected: <XCircle className="w-5 h-5 text-destructive" />,
		error: <AlertCircle className="w-5 h-5 text-destructive" />,
		loading: <LoaderPinwheel className="w-5 h-5 text-info animate-spin" />,
		feedback: <MessageCircleReply className="w-5 h-5 text-destructive" />,
	}

	if (!approvalState) {
		return null
	}

	return (
		<div
			className={cn(
				"border-l-4 p-3 bg-card text-card-foreground rounded-sm",
				{
					"border-primary": variant === "primary",
					"border-secondary": variant === "info",
					"border-accent": variant === "accent",
					"border-success": variant === "success",
					"border-info": variant === "info",
					"border-muted": variant === "default",
					"border-destructive": variant === "destructive",
				},
				isSubMsg && "!-mt-5"
			)}>
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center">
					<Icon className={cn("w-5 h-5 mr-2", `text-${variant}`)} />
					<h3 className="text-sm font-semibold">{title}</h3>
				</div>

				{userFeedback ? (
					<Tooltip>
						<TooltipTrigger>{stateIcons["feedback"]}</TooltipTrigger>
						<TooltipContent side="left">The tool got rejected with feedback</TooltipContent>
					</Tooltip>
				) : (
					stateIcons[approvalState]
				)}
			</div>
			<div className="text-sm">{children}</div>
		</div>
	)
}

export const DevServerToolBlock: React.FC<ServerRunnerTool & ToolAddons> = ({
	commandType,
	commandToRun,
	approvalState,

	tool,
	serverName,
	ts,
	output,
	...rest
}) => {
	const [isOpen, setIsOpen] = useState(false)

	const getIcon = () => {
		switch (commandType) {
			case "start":
				return Play
			case "stop":
				return Square
			case "restart":
				return RefreshCw
			case "getLogs":
				return FileText
			default:
				return Server
		}
	}

	const Icon = getIcon()

	return (
		<ToolBlock
			{...rest}
			ts={ts}
			tool={tool}
			icon={Icon}
			// title={`Dev Server - ${commandType?.charAt(0)?.toUpperCase?.() + commandType?.slice?.(1)}`}
			title={`Dev Server - ${serverName}`}
			variant="primary"
			approvalState={approvalState}>
			<div className="bg-muted p-2 rounded font-mono text-xs overflow-x-auto">
				<span className="text-success">$</span> {commandToRun}
			</div>

			{approvalState === "loading" && (
				<div className="mt-2 flex items-center">
					<span className="text-xs mr-2">
						Server is {commandType === "stop" ? "stopping" : "starting"}...
					</span>
					<div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
				</div>
			)}

			{output && (
				<Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="flex items-center w-full justify-between">
							<span>View Output</span>
							{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="mt-2">
						<ScrollArea className="h-[200px] w-full rounded-md border">
							<ScrollArea className="h-[200px] w-full rounded-md border">
								<div className="p-4">
									<pre className="text-sm whitespace-pre-wrap text-pretty break-all">{output}</pre>
								</div>{" "}
								<ScrollBar orientation="vertical" />
							</ScrollArea>

							<ScrollBar orientation="vertical" />
						</ScrollArea>
					</CollapsibleContent>
				</Collapsible>
			)}

			{approvalState === "approved" && commandType === "start" && (
				<p className="text-xs mt-2 text-success">Server started successfully.</p>
			)}

			{approvalState === "approved" && commandType === "stop" && (
				<p className="text-xs mt-2 text-success">Server stopped successfully.</p>
			)}
			{approvalState === "approved" && commandType === "restart" && (
				<p className="text-xs mt-2 text-success">Server restarted successfully.</p>
			)}
			{approvalState === "approved" && commandType === "getLogs" && (
				<p className="text-xs mt-2 text-success">Server logs retrieved successfully.</p>
			)}

			{approvalState === "error" && (
				<p className="text-xs mt-2 text-destructive">An error occurred while {commandType}ing the server.</p>
			)}
		</ToolBlock>
	)
}
export const ChatTruncatedBlock = ({ ts }: { ts: number }) => {
	return (
		<ToolBlock
			ts={ts}
			tool="write_to_file"
			icon={Scissors}
			title="Chat Compressed"
			variant="info"
			approvalState="approved"
			isSubMsg={false}>
			<div className="space-y-4">
				<div className="bg-secondary/20 p-3 rounded-md">
					<p className="text-sm">
						The conversation history was compressed before reaching the maximum context window. Previous
						content may be unavailable, but the task can continue.
					</p>
				</div>
			</div>
		</ToolBlock>
	)
}

export const ChatMaxWindowBlock = ({ ts }: { ts: number }) => (
	<ToolBlock
		icon={AlertCircle}
		title="Maximum Context Reached"
		variant="destructive"
		approvalState="approved"
		isSubMsg={false}
		ts={ts}
		tool="write_to_file">
		<div className="bg-destructive/20 p-3 rounded-md">
			<p className="text-sm font-medium">This task has reached its maximum context limit and cannot continue.</p>
			<p className="text-sm mt-2">Please start a new task to continue working. Your progress has been saved.</p>
		</div>
	</ToolBlock>
)

export const ExecuteCommandBlock: React.FC<
	ExecuteCommandTool &
		ToolAddons & {
			hasNextMessage?: boolean
		}
> = ({ command, output, approvalState, tool, ts, ...rest }) => {
	const [isOpen, setIsOpen] = React.useState(false)

	return (
		<ToolBlock
			{...rest}
			ts={ts}
			tool={tool}
			icon={Terminal}
			title="Execute Command"
			variant="info"
			approvalState={approvalState}>
			<div className="bg-muted p-2 rounded font-mono text-xs overflow-x-auto">
				<span className="text-success">$</span> {command}
			</div>
			{output && (
				<Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="flex items-center w-full justify-between">
							<span>View Output</span>
							{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="mt-2">
						<ScrollArea className="h-[200px] w-full rounded-md border">
							<div className="bg-secondary/20 p-3 rounded-md text-sm">
								<pre className="whitespace-pre-wrap text-pretty break-all">{output}</pre>
							</div>
							<ScrollBar orientation="vertical" />
						</ScrollArea>
					</CollapsibleContent>
				</Collapsible>
			)}
		</ToolBlock>
	)
}

export const ListFilesBlock: React.FC<ListFilesTool & ToolAddons> = ({
	path,
	recursive,
	approvalState,

	tool,
	ts,
	...rest
}) => (
	<ToolBlock
		{...rest}
		ts={ts}
		tool={tool}
		icon={FolderTree}
		title="List Files"
		variant="info"
		approvalState={approvalState}>
		<p className="text-xs">
			<span className="font-semibold">Folder:</span> {path}
		</p>
		<p className="text-xs">
			<span className="font-semibold">Include subfolders:</span> {recursive || "No"}
		</p>
	</ToolBlock>
)

export const ExploreRepoFolderBlock: React.FC<ExploreRepoFolderTool & ToolAddons> = ({
	path,
	approvalState,
	tool,
	ts,
	...rest
}) => (
	<ToolBlock
		{...rest}
		ts={ts}
		tool={tool}
		icon={Code}
		title="Explore Repository Folder"
		variant="accent"
		approvalState={approvalState}>
		<p className="text-xs">
			<span className="font-semibold">Scanning folder:</span> {path}
		</p>
	</ToolBlock>
)

export const SearchFilesBlock: React.FC<SearchFilesTool & ToolAddons> = ({
	path,
	regex,
	filePattern,
	approvalState,

	tool,
	ts,
	...rest
}) => (
	<ToolBlock
		{...rest}
		ts={ts}
		tool={tool}
		icon={Search}
		title="Search Files"
		variant="info"
		approvalState={approvalState}>
		<p className="text-xs">
			<span className="font-semibold">Search in:</span> {path}
		</p>
		<p className="text-xs">
			<span className="font-semibold">Look for:</span> {regex}
		</p>
		{filePattern && (
			<p className="text-xs">
				<span className="font-semibold">File types:</span> {filePattern}
			</p>
		)}
	</ToolBlock>
)

const CodeBlockMemorized = React.memo(({ content, path }: { content: string; path: string }) => {
	return (
		<ScrollArea className="h-[200px] w-full rounded-md border">
			<CodeBlock language={path} children={content} />
			<ScrollBar orientation="vertical" />
			<ScrollBar orientation="horizontal" />
		</ScrollArea>
	)
})

export const ReadFileBlock: React.FC<ReadFileTool & ToolAddons> = ({
	path,
	approvalState,
	content,
	tool,
	ts,
	pageNumber,
	readAllPages,
	...rest
}) => {
	const [isOpen, setIsOpen] = React.useState(false)
	const pathEnding = useMemo(() => getLanguageFromPath(path), [path])

	return (
		<ToolBlock
			{...rest}
			ts={ts}
			tool={tool}
			icon={FileText}
			title="Read File"
			variant="primary"
			approvalState={approvalState}>
			<p className="text-xs">
				<span className="font-semibold">File:</span> {path}
			</p>
			{typeof pageNumber === "number" && (
				<p className="text-xs">
					<span className="font-semibold">Page Number:</span> {pageNumber}
				</p>
			)}
			{typeof readAllPages === "boolean" && (
				<p className="text-xs">
					<span className="font-semibold">Read All Pages:</span> {readAllPages ? "Yes" : "No"}
				</p>
			)}

			{content && content.length > 0 && (
				<Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="flex items-center w-full justify-between">
							<span>View Content</span>
							{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="mt-2">
						{/* this optimize the render to not do heavy work unless it's open */}
						{isOpen && <CodeBlockMemorized content={content} path={pathEnding ?? "text"} />}
					</CollapsibleContent>
				</Collapsible>
			)}
		</ToolBlock>
	)
}

export type ToolStatus = "pending" | "rejected" | "approved" | "error" | "loading" | undefined

export const AskFollowupQuestionBlock: React.FC<AskFollowupQuestionTool & ToolAddons> = ({
	question,
	approvalState,

	tool,
	ts,
	...rest
}) => {
	return (
		<ToolBlock
			{...rest}
			ts={ts}
			tool={tool}
			icon={HelpCircle}
			title="Follow-up Question"
			variant="info"
			approvalState={approvalState}>
			<div className="bg-info/20 text-info-foreground p-2 rounded text-xs">
				<MarkdownRenderer>{question}</MarkdownRenderer>
			</div>
		</ToolBlock>
	)
}

export const AttemptCompletionBlock: React.FC<AttemptCompletionTool & ToolAddons> = ({
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
		icon={CheckCircle}
		title="Task Completion"
		variant={approvalState === "approved" ? "success" : "info"}
		approvalState={approvalState}>
		{/* {command && (
			<div className="bg-muted p-2 rounded font-mono text-xs overflow-x-auto mb-2">
				<span className="text-success">$</span> {command}
			</div>
		)} */}
		<div className="bg-success/20 text-success-foreground p-2 rounded text-xs w-full flex">
			<MarkdownRenderer markdown={result?.trim()} />
		</div>
	</ToolBlock>
)

export const UrlScreenshotBlock: React.FC<UrlScreenshotTool & ToolAddons> = ({
	url,
	approvalState,

	tool,
	base64Image,
	ts,
	...rest
}) => (
	<ToolBlock
		{...rest}
		ts={ts}
		tool={tool}
		icon={Image}
		title="URL Screenshot"
		variant="accent"
		approvalState={approvalState}>
		<p className="text-xs">
			<span className="font-semibold">Website:</span> {url}
		</p>
		{base64Image && (
			<div className="bg-muted rounded-md mt-2 text-xs w-full max-h-40 overflow-auto">
				<img src={`data:image/png;base64,${base64Image}`} alt="URL Screenshot" />
			</div>
		)}
	</ToolBlock>
)
export const SearchSymbolBlock: React.FC<SearchSymbolsTool & ToolAddons> = ({
	symbolName,
	content,
	approvalState,
	tool,
	ts,
	...rest
}) => {
	const [isOpen, setIsOpen] = React.useState(false)

	return (
		<ToolBlock
			{...rest}
			ts={ts}
			tool={tool}
			icon={Search}
			title="Search Symbols"
			variant="accent"
			approvalState={approvalState}>
			<p className="text-xs">
				<span className="font-semibold">Symbol:</span> {symbolName}
			</p>
			{content && (
				<Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="flex items-center w-full justify-between">
							<span>View Results</span>
							{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="mt-2">
						<ScrollArea className="h-[200px] w-full rounded-md border">
							<div className="bg-secondary/20 p-3 rounded-md text-sm">
								<pre className="whitespace-pre-wrap">{content}</pre>
							</div>
							<ScrollBar orientation="vertical" />
						</ScrollArea>
					</CollapsibleContent>
				</Collapsible>
			)}
		</ToolBlock>
	)
}

export const AddInterestedFileBlock: React.FC<AddInterestedFileTool & ToolAddons> = ({
	path,
	why,
	approvalState,
	tool,
	ts,
	...rest
}) => (
	<ToolBlock
		{...rest}
		ts={ts}
		tool={tool}
		icon={FileText}
		title="Track File"
		variant="info"
		approvalState={approvalState}>
		<p className="text-xs">
			<span className="font-semibold">File:</span> {path}
		</p>
		<p className="text-xs">
			<span className="font-semibold">Reason:</span> {why}
		</p>
	</ToolBlock>
)

export const FileChangesPlanBlock: React.FC<
	FileChangePlanTool &
		ToolAddons & {
			innerThoughts?: string
			innerSelfCritique?: string
			rejectedString?: string
		}
> = ({
	path,
	what_to_accomplish,
	approvalState,
	tool,
	ts,
	innerThoughts = "",
	innerSelfCritique = "",
	rejectedString,
	...rest
}) => {
	const [isReasoningOpen, setIsReasoningOpen] = React.useState(false)

	return (
		<ToolBlock
			{...rest}
			ts={ts}
			tool={tool}
			icon={FileText}
			title="File Changes Plan"
			variant="info"
			approvalState={approvalState}>
			<div className="text-xs space-y-3">
				<div className="space-y-1">
					<p>
						<span className="font-semibold">File:</span> {path}
					</p>
					<div>
						<span className="font-semibold">What to accomplish:</span>
						<div className="mt-1 bg-muted p-2 rounded-md">
							<MarkdownRenderer markdown={what_to_accomplish?.trim() ?? ""} />
						</div>
					</div>
				</div>

				{(innerThoughts.trim() || innerSelfCritique.trim()) && (
					<Collapsible
						open={isReasoningOpen}
						onOpenChange={setIsReasoningOpen}
						className="border-t pt-3 mt-3">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="sm" className="flex items-center w-full justify-between px-0">
								<div className="flex items-center space-x-2">
									<MessageCircle className="h-4 w-4 text-info" />
									<span className="font-medium">View Kodu Reasoning Steps</span>
								</div>
								{isReasoningOpen ? (
									<ChevronUp className="h-4 w-4" />
								) : (
									<ChevronDown className="h-4 w-4" />
								)}
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-2 space-y-3">
							{innerThoughts.trim() && (
								<div className="bg-secondary/20 p-2 rounded-md">
									<h4 className="font-semibold flex items-center space-x-2 mb-1 text-xs uppercase tracking-wide text-secondary-foreground">
										<HelpCircle className="h-3 w-3" />
										<span>Inner Thoughts</span>
									</h4>
									<MarkdownRenderer markdown={innerThoughts.trim()} />
								</div>
							)}
							{innerSelfCritique.trim() && (
								<div className="bg-secondary/20 p-2 rounded-md">
									<h4 className="font-semibold flex items-center space-x-2 mb-1 text-xs uppercase tracking-wide text-secondary-foreground">
										<AlertCircle className="h-3 w-3" />
										<span>Inner Self-Critique</span>
									</h4>
									<MarkdownRenderer markdown={innerSelfCritique.trim()} />
								</div>
							)}
						</CollapsibleContent>
					</Collapsible>
				)}

				{rejectedString?.trim() && (
					<div className="bg-destructive/10 border border-destructive rounded-md p-3 mt-3">
						<div className="flex items-center space-x-2 mb-2 text-destructive">
							<AlertCircle className="h-4 w-4" />
							<span className="font-semibold text-sm">Plan Rejected</span>
						</div>
						<p className="text-sm text-destructive-foreground">
							Kodu decided to reject the change plan because of:
						</p>
						<div className="bg-destructive/20 p-2 rounded-md mt-2">
							<MarkdownRenderer markdown={rejectedString.trim()} />
						</div>
					</div>
				)}
			</div>
		</ToolBlock>
	)
}

export const SubmitReviewBlock: React.FC<SubmitReviewTool & ToolAddons> = ({
	review,
	approvalState,
	tool,
	ts,
	...rest
}) => {
	const [isOpen, setIsOpen] = React.useState(false)

	return (
		<ToolBlock
			{...rest}
			ts={ts}
			tool={tool}
			icon={ClipboardCheck}
			title="Submit Review"
			variant="accent"
			approvalState={approvalState}>
			<div className="text-xs space-y-3">
				{review && (
					<Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="sm" className="flex items-center w-full justify-between">
								<span>View Review</span>
								{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-2">
							<ScrollArea className="h-[200px] w-full rounded-md border">
								<div className="bg-secondary/20 p-3 rounded-md text-sm">
									<MarkdownRenderer markdown={review} />
								</div>
								<ScrollBar orientation="vertical" />
							</ScrollArea>
						</CollapsibleContent>
					</Collapsible>
				)}
			</div>
		</ToolBlock>
	)
}

export const ToolRenderer: React.FC<{
	tool: ChatTool
	hasNextMessage?: boolean
}> = ({ tool }) => {
	switch (tool.tool) {
		case "execute_command":
			return <ExecuteCommandBlock hasNextMessage {...tool} />
		case "list_files":
			return <ListFilesBlock {...tool} />
		case "explore_repo_folder":
			return <ExploreRepoFolderBlock {...tool} />
		case "search_files":
			return <SearchFilesBlock {...tool} />
		case "read_file":
			return <ReadFileBlock {...tool} />
		case "file_editor":
			return <FileEditorTool {...tool} />
		case "ask_followup_question":
			return <AskFollowupQuestionBlock {...tool} />
		case "attempt_completion":
			return <AttemptCompletionBlock {...tool} />
		case "web_search":
			return <EnhancedWebSearchBlock {...tool} />
		case "url_screenshot":
			return <UrlScreenshotBlock {...tool} />
		case "server_runner":
			return <DevServerToolBlock {...tool} />
		case "search_symbol":
			return <SearchSymbolBlock {...tool} />
		case "add_interested_file":
			return <AddInterestedFileBlock {...tool} />
		case "spawn_agent":
			return <SpawnAgentBlock {...tool} />
		case "exit_agent":
			return <ExitAgentBlock {...tool} />
		case "submit_review":
			return <SubmitReviewBlock {...tool} />
		default:
			return null
	}
}
