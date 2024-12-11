import { AlertCircle, LogIn, CreditCard, CircleX, X } from "lucide-react"
import { loginKodu } from "@/utils/kodu-links"
import { useExtensionState } from "@/context/extension-state-context"
import { vscode } from "@/utils/vscode"
import { getKoduOfferUrl } from "../../../../src/shared/kodu"
import { TextWithAttachments } from "@/utils/extract-attachments"
import { SyntaxHighlighterStyle } from "@/utils/get-syntax-highlighter-style-from-theme"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import React from "react"
import { V1ClaudeMessage, ClaudeSayTool } from "../../../../src/shared/extension-message"
import CodeBlock from "../code-block/code-block"
import Thumbnails from "../thumbnails/thumbnails"
import IconAndTitle from "./icon-and-title"
import MarkdownRenderer from "./markdown-renderer"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { Button } from "../ui/button"
import { AnimatePresence, m, motion } from "framer-motion"

export const APIRequestMessage: React.FC<{
	message: V1ClaudeMessage
	nextMessage?: V1ClaudeMessage

	syntaxHighlighterStyle: SyntaxHighlighterStyle
}> = React.memo(({ message, nextMessage, syntaxHighlighterStyle }) => {
	const { cost } = message.apiMetrics || {}
	const isError = message.isError || message.isAborted
	const [icon, title] = IconAndTitle({
		type: "api_req_started",
		cost: message.apiMetrics?.cost,
		isCommandExecuting: !!message.isExecutingCommand,
		/**
		 * ideally this would be automatically updated so isStreaming is only on until we reached error or success
		 */
		apiRequestFailedMessage: message.errorText || message.isError ? "Request Failed" : false,
	})

	const getStatusInfo = () => {
		if (message.isDone) {
			return { status: "", className: "text-success" }
		}
		if (message.retryCount) {
			return { status: `Retried (${message.retryCount})`, className: "text-error" }
		}
		if (message.isError) {
			return { status: "Error", className: "text-error" }
		}
		if (message.isFetching) {
			return { status: "", className: "" }
		}
		if (message.isAborted) {
			return { status: "Aborted", className: "text-error" }
		}

		return { status: "", className: "text-success" }
	}

	const { status, className } = getStatusInfo()

	return (
		<>
			<div className="flex-line">
				{icon}
				{title}
				{cost && (
					<Tooltip>
						<TooltipContent className="bg-secondary text-secondary-foreground">
							<div className="space-y-2">
								<h3 className="font-medium text-lg">Price Breakdown</h3>
								{Object.entries(message.apiMetrics!)
									.reverse()
									.map(([key, value], index) => (
										<div
											key={key}
											className={`flex justify-between ${
												index === Object.entries(message.apiMetrics!).length - 1
													? "pt-2 border-t border-gray-200 font-medium"
													: ""
											}`}>
											<span className="text-secondary-foreground/80">{key}</span>
											<span className="text-secondary-foreground">{value?.toFixed(2)}</span>
										</div>
									))}
							</div>
						</TooltipContent>
						<TooltipTrigger asChild>
							<code className="text-light">${Number(cost)?.toFixed(4)}</code>
						</TooltipTrigger>
					</Tooltip>
				)}
				<div className={`ml-2 ${className}`}>{status}</div>
				<div className="flex-1" />
				<AnimatePresence mode="wait"></AnimatePresence>
			</div>
			{isError && <div className="text-error">{message.errorText || "An error occurred. Please try again."}</div>}
		</>
	)
})

export const TextMessage: React.FC<{ message: V1ClaudeMessage; syntaxHighlighterStyle: SyntaxHighlighterStyle }> =
	React.memo(({ message, syntaxHighlighterStyle }) => (
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
	syntaxHighlighterStyle: SyntaxHighlighterStyle
}> = React.memo(({ message, syntaxHighlighterStyle }) => {
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
				syntaxHighlighterStyle={syntaxHighlighterStyle}
				isExpanded={isExpanded}
				onToggleExpand={onToggleExpand}
			/>
		</div>
	)
})

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
