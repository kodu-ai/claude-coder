import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { ClaudeMessage, ClaudeSayTool, V1ClaudeMessage } from "../../../../src/shared/ExtensionMessage"
import { COMMAND_OUTPUT_STRING } from "../../../../src/shared/combineCommandSequences"
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import CodeBlock from "../CodeBlock/CodeBlock"
import Thumbnails from "../Thumbnails/Thumbnails"
import Terminal from "../Terminal/Terminal"
import IconAndTitle from "./IconAndTitle"
import MarkdownRenderer from "./MarkdownRenderer"
import ToolRenderer from "./ToolRenderer"

interface ChatRowProps {
	message: ClaudeMessage
	syntaxHighlighterStyle: SyntaxHighlighterStyle
	nextMessage?: ClaudeMessage
	isLast: boolean
	handleSendStdin: (text: string) => void
}

const APIRequestMessage: React.FC<{
	message: ClaudeMessage
	nextMessage?: ClaudeMessage
	syntaxHighlighterStyle: SyntaxHighlighterStyle
}> = React.memo(({ message, nextMessage, syntaxHighlighterStyle }) => {
	const cost = message.text ? JSON.parse(message.text).cost : undefined
	const [icon, title] = IconAndTitle({
		type: "api_req_started",
		cost,
		isCommandExecuting: false,
		/**
		 * ideally this would be automatically updated so isStreaming is only on until we reached error or success
		 */
		apiRequestFailedMessage: undefined,
	})

	const getStatusInfo = () => {
		if (nextMessage?.ask === "api_req_failed") {
			return { status: "", className: "text-error" }
		} else if (nextMessage?.say === "error") {
			return { status: "Error", className: "text-error" }
		} else if (nextMessage?.say === "api_req_started") {
			console.log(nextMessage.text)
			const retryCount = parseInt(nextMessage.text?.match(/Retry attempt: (\d+)/)?.[1] || "0")
			return { status: `Retried (${retryCount})`, className: "text-warning" }
		} else if (nextMessage?.say !== "api_req_finished") {
			return {}
		}
		return { status: "Success", className: "text-success" }
	}

	const { status, className } = getStatusInfo()

	return (
		<>
			<div className="flex-line">
				{icon}
				{title}
				{cost && <code className="text-light">${Number(cost)?.toFixed(4)}</code>}
				<div className={`ml-2 ${className}`}>{status}</div>
				<div className="flex-1" />
			</div>
			{!cost && nextMessage?.ask === "api_req_failed" && <div className="text-error">{nextMessage.text}</div>}
		</>
	)
})

const TextMessage: React.FC<{ message: ClaudeMessage; syntaxHighlighterStyle: SyntaxHighlighterStyle }> = React.memo(
	({ message, syntaxHighlighterStyle }) => (
		<MarkdownRenderer markdown={message.text || ""} syntaxHighlighterStyle={syntaxHighlighterStyle} />
	)
)

const UserFeedbackMessage: React.FC<{ message: ClaudeMessage }> = React.memo(({ message }) => (
	<div style={{ display: "flex", alignItems: "start", gap: "8px" }}>
		<span className="codicon codicon-account" style={{ marginTop: "2px" }} />
		<div style={{ display: "grid", gap: "8px" }}>
			<div>{message.text}</div>
			{message.images && message.images.length > 0 && <Thumbnails images={message.images} />}
		</div>
	</div>
))

const UserFeedbackDiffMessage: React.FC<{
	message: ClaudeMessage
	syntaxHighlighterStyle: SyntaxHighlighterStyle
}> = React.memo(({ message, syntaxHighlighterStyle }) => {
	const [isExpanded, onToggleExpand] = React.useState(false)
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
				onToggleExpand={() => onToggleExpand(!isExpanded)}
			/>
		</div>
	)
})

const CommandMessage: React.FC<{
	message: ClaudeMessage
	isCommandExecuting: boolean
	handleSendStdin: (text: string) => void
}> = React.memo(({ message, isCommandExecuting, handleSendStdin }) => {
	const [icon, title] = IconAndTitle({ type: "command", isCommandExecuting })
	const splitMessage = (text: string) => {
		const outputIndex = text.indexOf(COMMAND_OUTPUT_STRING)
		if (outputIndex === -1) {
			return { command: text, output: "" }
		}
		return {
			command: text.slice(0, outputIndex).trim(),
			output: text.slice(outputIndex + COMMAND_OUTPUT_STRING.length).trim() + " ",
		}
	}

	const { command, output } = splitMessage(message.text || "")
	return (
		<>
			<h3 className="flex-line">
				{icon}
				{title}
			</h3>
			<Terminal
				rawOutput={command + (output ? "\n" + output : "")}
				handleSendStdin={handleSendStdin}
				shouldAllowInput={!!isCommandExecuting && output.length > 0}
			/>
		</>
	)
})

const ChatRow: React.FC<ChatRowProps> = ({ message, syntaxHighlighterStyle, nextMessage, isLast, handleSendStdin }) => {
	const isCommandExecuting = !!(
		isLast &&
		nextMessage?.ask === "command" &&
		nextMessage?.text?.includes(COMMAND_OUTPUT_STRING)
	)

	const renderContent = () => {
		switch (message.type) {
			case "say":
				switch (message.say) {
					case "api_req_started":
						return (
							<APIRequestMessage
								message={message}
								nextMessage={nextMessage}
								syntaxHighlighterStyle={syntaxHighlighterStyle}
							/>
						)
					case "api_req_finished":
						return null
					case "text":
						return <TextMessage message={message} syntaxHighlighterStyle={syntaxHighlighterStyle} />
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
					case "tool":
						return (
							<ToolRenderer
								message={message as V1ClaudeMessage}
								syntaxHighlighterStyle={syntaxHighlighterStyle}
								nextMessage={nextMessage as V1ClaudeMessage}
							/>
						)
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
				switch (message.ask) {
					case "tool":
						return (
							<ToolRenderer
								message={message as V1ClaudeMessage}
								syntaxHighlighterStyle={syntaxHighlighterStyle}
							/>
						)
					case "command":
						return (
							<CommandMessage
								message={message}
								isCommandExecuting={isCommandExecuting}
								handleSendStdin={handleSendStdin}
							/>
						)
					case "completion_result":
						if (message.text) {
							const [icon, title] = IconAndTitle({
								type: "completion_result",
								cost: undefined,
								isCommandExecuting: false,
							})
							return (
								<>
									<h3 className="flex-line">
										{icon}
										{title}
									</h3>
									<div className="text-success">
										<TextMessage
											message={message}
											syntaxHighlighterStyle={syntaxHighlighterStyle}
										/>
									</div>
								</>
							)
						} else {
							return null
						}
					case "api_req_failed":
						return null
					case "followup": {
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
				}
		}
	}

	if (renderContent() === null) {
		return null
	}
	return <section>{renderContent()}</section>
}

export default React.memo(ChatRow)
