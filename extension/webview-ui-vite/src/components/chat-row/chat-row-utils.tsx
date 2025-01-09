import { AlertCircle, LogIn, CreditCard, CircleX, X, ChevronDown, ChevronRight, Settings } from "lucide-react"
import { loginKodu } from "@/utils/kodu-links"
import { useExtensionState } from "@/context/extension-state-context"

function formatElapsedTime(ms: number): string {
	const seconds = Math.floor(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60

	if (minutes > 0) {
		return `${minutes}m ${remainingSeconds}s`
	}
	return `${seconds}s`
}
import { useCollapseState } from "@/context/collapse-state-context"
import { vscode } from "@/utils/vscode"
import { getKoduOfferUrl } from "../../../../src/shared/kodu"
import { TextWithAttachments } from "@/utils/extract-attachments"
import { SyntaxHighlighterStyle } from "@/utils/get-syntax-highlighter-style-from-theme"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import React from "react"
import { V1ClaudeMessage, ClaudeSayTool } from "../../../../src/shared/messages/extension-message"
import CodeBlock from "../code-block/code-block"
import Thumbnails from "../thumbnails/thumbnails"
import IconAndTitle from "./icon-and-title"
import MarkdownRenderer from "./markdown-renderer"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { Button } from "../ui/button"
import { AnimatePresence, m, motion } from "framer-motion"
import { Badge } from "../ui/badge"

import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSwitchToProviderManager } from "../settings-view/preferences/atoms"

function StatusIcon({ message }: { message: V1ClaudeMessage }) {
	if (message.isError || message.isAborted) return <XCircle className="shrink-0 h-4 w-4 text-destructive" />
	if (message.isFetching) return <Loader2 className="shrink-0 h-4 w-4 animate-spin text-info" />
	if (message.retryCount) return <AlertCircle className="shrink-0 h-4 w-4 text-warning" />
	if (message.isDone) return <CheckCircle className="shrink-0 h-4 w-4 text-success" />
	return null
}

export const APIRequestMessage: React.FC<{ message: V1ClaudeMessage }> = React.memo(({ message }) => {
	const { toggleCollapse, isCollapsed } = useCollapseState()
	const collapsed = isCollapsed(message.ts)
	const { cost } = message?.apiMetrics || {}
	const apiRequestFailedMessage = message.errorText || message.isError ? "Request Failed" : false
	const [icon, title] = IconAndTitle({
		type: "api_req_started",
		cost: message.apiMetrics?.cost,
		isCommandExecuting: !!message.isExecutingCommand,
		apiRequestFailedMessage,
		isCompleted: message.isDone,
	})
	if (message?.agentName) {
		// @ts-expect-error - agentName is literal string
		message.agentName = message.agentName
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ")
	}

	// Combine agent and model into one concise badge
	const agentModelText = [message?.agentName, message?.modelId].filter(Boolean).join(" @ ")

	return (
		<>
			<div
				className={cn(
					"flex items-center w-full text-sm gap-2 overflow-hidden group",
					"px-2 py-1 bg-card text-card-foreground rounded-sm",
					"hover:bg-card/80 transition-colors"
				)}
				style={{ maxWidth: "100%" }}>
				{/* Status Icon at the start */}
				<StatusIcon message={message} />

				{/* Title next to status */}
				<span className="font-medium shrink-0">{title}</span>

				{/* Agent/Model badge if present */}
				{agentModelText && (
					<Tooltip>
						<TooltipContent className="bg-secondary text-secondary-foreground">
							<div className="space-y-2">
								<h4 className="font-medium text-md ">Model Info</h4>
								<div className="flex justify-between">
									<span className="text-secondary-foreground/80">Agent</span>
									<span className="text-secondary-foreground">
										{message.agentName ?? "Kodu Main"}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-secondary-foreground/80 shrink-0 mr-2">Model</span>
									<span className="text-secondary-foreground truncate">{message.modelId}</span>
								</div>
								<div className="border-t border-border/40 my-2 pt-2">
									<h4 className="font-medium text-md mb-2">Timing</h4>
									<div className="flex justify-between">
										<span className="text-secondary-foreground/80">Started</span>
										<span className="text-secondary-foreground">
											{new Date(message.ts).toLocaleTimeString()}
										</span>
									</div>
									{message.completedAt && (
										<>
											<div className="flex justify-between">
												<span className="text-secondary-foreground/80">Completed</span>
												<span className="text-secondary-foreground">
													{new Date(message.completedAt).toLocaleTimeString()}
												</span>
											</div>
											<div className="flex justify-between font-medium">
												<span className="text-secondary-foreground/80">Duration</span>
												<span className="text-secondary-foreground">
													{formatElapsedTime(message.completedAt - message.ts)}
												</span>
											</div>
										</>
									)}
								</div>
								<div className="border-t border-border/40 pt-2">
									<h4 className="font-medium text-md mb-2">Price Breakdown</h4>
								</div>
								{Object.entries(message?.apiMetrics ?? {})
									.reverse()
									.map(([key, value], index) => (
										<div
											key={key}
											className={`flex justify-between ${
												index === Object.entries(message.apiMetrics!).length - 1
													? "pt-2 border-t border-foreground/80 font-medium"
													: ""
											}`}>
											<span className="text-secondary-foreground/80">{key}</span>
											<span className="text-secondary-foreground">{value?.toFixed(2)}</span>
										</div>
									))}
							</div>
						</TooltipContent>
						<div className="flex w-full overflow-hidden ml-auto justify-end">
							<TooltipTrigger
								className="text-[11px] truncate flex" // w-32 or some fixed width class
							>
								<Badge variant="secondary" className="text-[11px] truncate flex">
									<span className="truncate">{agentModelText}</span>
									{/* {agentModelText} */}
								</Badge>
							</TooltipTrigger>
						</div>
					</Tooltip>
				)}

				<div className="flex-1" />

				{/* Collapse button */}
				<Button variant="ghost" size="icon" className={cn("size-5")} onClick={() => toggleCollapse(message.ts)}>
					<ChevronDown
						style={{
							transform: collapsed ? "rotate(90deg)" : "rotate(0deg)",
						}}
						className={cn("size-4 transform transition-transform duration-200 ease-in-out")}
					/>
				</Button>
			</div>
			{message.isError && <span className="text-destructive p-2 flex">{message.errorText}</span>}
		</>
	)
})
export const TextMessage: React.FC<{ message: V1ClaudeMessage }> = React.memo(({ message }) => (
	<div className="flex text-wrap flex-wrap gap-2">
		<MarkdownRenderer markdown={message.text || ""} />
	</div>
))

export const UserFeedbackMessage: React.FC<{ message: V1ClaudeMessage }> = React.memo(({ message }) => {
	return (
		<div style={{ display: "flex", alignItems: "start", gap: "8px" }}>
			<span className="codicon codicon-account" style={{ marginTop: "2px" }} />
			<div style={{ display: "grid", gap: "8px" }}>
				<TextWithAttachments text={message.text} />
				{message.images && message.images.length > 0 && <Thumbnails images={message.images} />}
			</div>
		</div>
	)
})

export const InfoMessage: React.FC<{ message: V1ClaudeMessage }> = React.memo(({ message }) => (
	<div style={{ display: "flex", alignItems: "start", gap: "8px" }} className="text-info">
		<div style={{ display: "grid", gap: "8px" }}>
			<span className="codicon codicon-info" style={{ marginTop: "2px" }} />
			<div>{message.text}</div>
		</div>
	</div>
))

export const UserFeedbackDiffMessage: React.FC<{
	message: V1ClaudeMessage
}> = React.memo(({ message }) => {
	const [isExpanded, setToggle] = React.useState(false)
	const onToggleExpand = () => setToggle(!isExpanded)
	const tool = JSON.parse(message.text || "{}") as ClaudeSayTool
	return (
		<div
			style={{
				backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
				borderRadius: "3px",
				padding: "8px",
				whiteSpace: "pre-line",
				wordWrap: "break-word",
			}}>
			<span
				style={{
					display: "block",
					fontStyle: "italic",
					marginBottom: "8px",
					opacity: 0.8,
				}}>
				The user made the following changes:
			</span>
			<CodeBlock
				// @ts-expect-error - diff is not always defined
				diff={tool.diff!}
				// @ts-expect-error - path is not always defined
				path={tool.path!}
				isExpanded={isExpanded}
				onToggleExpand={onToggleExpand}
			/>
		</div>
	)
})

export function CustomProviderSettingRequired({ text }: { text: string }) {
	const switchToProvider = useSwitchToProviderManager()
	return (
		<div className="border border-destructive/50 rounded-md p-4 max-w-[360px] mx-auto bg-background/5">
			<div className="flex items-center space-x-2 text-destructive">
				<AlertCircle className="h-4 w-4" />
				<h4 className="font-semibold text-sm">Provider Configuration Required</h4>
			</div>
			<p className="text-destructive/90 text-xs mt-2">
				Yikes! Looks like you need to configure a custom provider to use this feature.
			</p>
			<button className="w-full mt-3 py-1 px-2 text-xs border border-destructive/50 rounded hover:bg-destructive/10 transition-colors">
				<span
					onClick={() => {
						let providerSettings: {
							providerId?: string
						} = {}
						try {
							providerSettings = JSON.parse(text) as { providerId: string }
						} catch (e) {
							console.error(e)
						}
						// @ts-expect-error - providerId is not always defined
						switchToProvider(providerSettings?.providerId)
					}}
					className="flex items-center justify-center">
					<Settings className="mr-2 h-3 w-3" /> Configure Provider
				</span>
			</button>
		</div>
	)
}

export function ErrorMsgComponent({ type }: { type: "unauthorized" | "payment_required" }) {
	const { uriScheme, extensionName } = useExtensionState()
	return (
		<div className="border border-destructive/50 rounded-md p-4 max-w-[360px] mx-auto bg-background/5">
			<div className="flex items-center space-x-2 text-destructive">
				<AlertCircle className="h-4 w-4" />
				<h4 className="font-semibold text-sm">
					{type === "unauthorized" ? "Unauthorized Access" : "Payment Required"}
				</h4>
			</div>
			<p className="text-destructive/90 text-xs mt-2">
				{type === "unauthorized"
					? "You are not authorized to run this command. Please log in or contact your administrator."
					: "You have run out of credits. Please contact your administrator."}
			</p>
			<button className="w-full mt-3 py-1 px-2 text-xs border border-destructive/50 rounded hover:bg-destructive/10 transition-colors">
				{type === "unauthorized" ? (
					<span
						onClick={() => loginKodu({ uriScheme: uriScheme!, extensionName: extensionName! })}
						className="flex items-center justify-center">
						<LogIn className="mr-2 h-3 w-3" /> Log In
					</span>
				) : (
					<a className="!text-foreground" href={getKoduOfferUrl(uriScheme)}>
						<span
							onClick={() => {
								vscode.postTrackingEvent("OfferwallView")
								vscode.postTrackingEvent("ExtensionCreditAddSelect", "offerwall")
							}}
							className="flex items-center justify-center">
							<CreditCard className="mr-2 h-3 w-3" /> FREE Credits
						</span>
					</a>
				)}
			</button>
		</div>
	)
}
