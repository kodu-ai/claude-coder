import React from "react"
import { V1ClaudeMessage } from "../../../../src/shared/ExtensionMessage"
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import IconAndTitle from "./IconAndTitle"
import ToolRenderer from "./ToolRenderer"
import MemoryUpdate from "./memory-update"
import { cn } from "../../lib/utils"
import {
	ErrorMsgComponent,
	APIRequestMessage,
	TextMessage,
	InfoMessage,
	UserFeedbackMessage,
	UserFeedbackDiffMessage,
} from "./ChatRowUtilts"

interface ChatRowProps {
	message: V1ClaudeMessage
	syntaxHighlighterStyle: SyntaxHighlighterStyle
	nextMessage?: V1ClaudeMessage
	isLast: boolean
	handleSendStdin: (text: string) => void
}

/**
 * @description removes <thinking> and </thinking> from text
 * @param text
 * @returns
 */
const removeThinking = (text?: string) => {
	return text?.replace(/<thinking>|<\/thinking>/g, "")
}

const ChatRowV1: React.FC<ChatRowProps> = ({ message, syntaxHighlighterStyle, nextMessage }) => {
	message.text = removeThinking(message.text!)

	const renderTextContent = () => {
		switch (message.type) {
			case "say":
				switch (message.say) {
					case "unauthorized":
						return <ErrorMsgComponent type="unauthorized" />
					case "payment_required":
						return <ErrorMsgComponent type="payment_required" />
					case "api_req_started":
						return (
							<APIRequestMessage
								message={message}
								nextMessage={nextMessage}
								syntaxHighlighterStyle={syntaxHighlighterStyle}
							/>
						)
					case "memory_updated":
						return (
							<MemoryUpdate
								message={{
									title: "Memory Updated",
									content: message.text!,
									say: "success",
								}}
							/>
						)
					case "api_req_finished":
						return null
					case "text":
						return <TextMessage message={message} syntaxHighlighterStyle={syntaxHighlighterStyle} />
					case "info":
						return <InfoMessage message={message} />
					case "user_feedback":
						return <UserFeedbackMessage message={message} />
					case "user_feedback_diff":
						return (
							<UserFeedbackDiffMessage
								message={message}
								syntaxHighlighterStyle={syntaxHighlighterStyle}
							/>
						)
					case "error":
					case "completion_result": {
						const [icon, title] = IconAndTitle({ type: message.say, isCommandExecuting: false })
						return (
							<>
								<h3 className={`flex-line ${message.say === "error" ? "text-error" : "text-success"}`}>
									{icon}
									{title}
								</h3>
								<div className={message.say === "error" ? "text-error" : "text-success"}>
									<TextMessage message={message} syntaxHighlighterStyle={syntaxHighlighterStyle} />
								</div>
							</>
						)
					}
					case "shell_integration_warning":
						return (
							<>
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										backgroundColor: "rgba(255, 191, 0, 0.1)",
										padding: 8,
										borderRadius: 3,
										fontSize: 12,
									}}>
									<div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
										<i
											className="codicon codicon-warning"
											style={{
												marginRight: 8,
												fontSize: 18,
												color: "#FFA500",
											}}></i>
										<span style={{ fontWeight: 500, color: "#FFA500" }}>
											Shell Integration Unavailable
										</span>
									</div>
									<div>
										Claude won't be able to view the command's output. Please update VSCode (
										<code>CMD/CTRL + Shift + P</code> → "Update") and make sure you're using a
										supported shell: zsh, bash, fish, or PowerShell (
										<code>CMD/CTRL + Shift + P</code> → "Terminal: Select Default Profile").{" "}
										<a
											href="https://github.com/kodu-ai/claude-coder/wiki/Troubleshooting-terminal-issues"
											style={{ color: "inherit", textDecoration: "underline" }}>
											Still having trouble?
										</a>
									</div>
								</div>
							</>
						)
					default: {
						const [defaultIcon, defaultTitle] = IconAndTitle({
							type: message.say,
							isCommandExecuting: false,
							apiRequestFailedMessage: message.errorText,
							cost: message.apiMetrics?.cost,
						})
						return (
							<>
								{defaultTitle && (
									<h3 className="flex-line">
										{defaultIcon}
										{defaultTitle}
									</h3>
								)}
								<TextMessage message={message} syntaxHighlighterStyle={syntaxHighlighterStyle} />
							</>
						)
					}
				}
			case "ask":
				if (message.ask === "api_req_failed") {
					return null
				}
				if (message.ask === "followup") {
					const [icon, title] = IconAndTitle({ type: message.ask, isCommandExecuting: false })
					return (
						<>
							{title && (
								<h3 className={`flex-line`}>
									{icon}
									{title}
								</h3>
							)}
							<TextMessage message={message} syntaxHighlighterStyle={syntaxHighlighterStyle} />
						</>
					)
				}
				return null
		}
	}

	const renderToolContent = () => {
		if (message.type === "say" && message.say === "tool") {
			return (
				<ToolRenderer
					message={message}
					syntaxHighlighterStyle={syntaxHighlighterStyle}
					nextMessage={nextMessage}
				/>
			)
		}
		if (message.type === "ask" && message.ask === "tool") {
			return <ToolRenderer message={message} syntaxHighlighterStyle={syntaxHighlighterStyle} />
		}
		return null
	}

	const textContent = renderTextContent()
	const toolContent = renderToolContent()

	if (!textContent && !toolContent) {
		return null
	}

	return (
		<section
			className={cn(
				"!border-b-0 border-t-border border-t-2",
				message.text?.includes('"tool":"') && "!border-t-0 !py-1"
			)}>
			{/* Text content container */}
			{textContent && <div>{textContent}</div>}

			{/* Tool content container - always at the bottom */}
			{toolContent && (
				<div className={cn("tool-content", textContent ? "mt-4 pt-4 border-t border-border" : "")}>
					{toolContent}
				</div>
			)}
		</section>
	)
}

export default ChatRowV1
