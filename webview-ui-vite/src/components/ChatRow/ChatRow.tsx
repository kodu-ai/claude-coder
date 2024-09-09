import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { ClaudeMessage, ClaudeSayTool } from "../../../../src/shared/ExtensionMessage"
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
	isExpanded: boolean
	onToggleExpand: () => void
	nextMessage?: ClaudeMessage
	isLast: boolean
	handleSendStdin: (text: string) => void
}

const APIRequestMessage: React.FC<{
	message: ClaudeMessage
	nextMessage?: ClaudeMessage
	isExpanded: boolean
	onToggleExpand: () => void
	syntaxHighlighterStyle: SyntaxHighlighterStyle
}> = React.memo(({ message, nextMessage, isExpanded, onToggleExpand, syntaxHighlighterStyle }) => {
	const cost = message.text ? JSON.parse(message.text).cost : undefined
	const [icon, title] = IconAndTitle({
		type: "api_req_started",
		cost,
		isCommandExecuting: false,
		apiRequestFailedMessage: nextMessage?.text,
	})

	const getStatusInfo = () => {
		if (nextMessage?.ask === "api_req_failed") {
			return { status: "", className: "text-error" }
		} else if (nextMessage?.say === "error") {
			return { status: "Error", className: "text-error" }
		} else if (nextMessage?.say === "api_req_started") {
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
				<VSCodeButton appearance="icon" aria-label="Toggle Details" onClick={onToggleExpand}>
					<span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`} />
				</VSCodeButton>
			</div>
			{!cost && nextMessage?.ask === "api_req_failed" && <div className="text-error">{nextMessage.text}</div>}
			{isExpanded && (
				<div style={{ marginTop: "10px" }}>
					<CodeBlock
						code={JSON.stringify(JSON.parse(message.text || "{}").request, null, 2)}
						language="json"
						syntaxHighlighterStyle={syntaxHighlighterStyle}
						isExpanded={true}
						onToggleExpand={onToggleExpand}
					/>
				</div>
			)}
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
	isExpanded: boolean
	onToggleExpand: () => void
}> = React.memo(({ message, syntaxHighlighterStyle, isExpanded, onToggleExpand }) => {
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
				diff={tool.diff!}
				path={tool.path!}
				syntaxHighlighterStyle={syntaxHighlighterStyle}
				isExpanded={isExpanded}
				onToggleExpand={onToggleExpand}
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

const ChatRow: React.FC<ChatRowProps> = ({
	message,
	syntaxHighlighterStyle,
	isExpanded,
	onToggleExpand,
	nextMessage,
	isLast,
	handleSendStdin,
}) => {
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
								isExpanded={isExpanded}
								onToggleExpand={onToggleExpand}
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
								isExpanded={isExpanded}
								onToggleExpand={onToggleExpand}
							/>
						)
					case "error":
					case "completion_result":
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
					case "tool":
						return (
							<ToolRenderer
								message={message}
								syntaxHighlighterStyle={syntaxHighlighterStyle}
								isExpanded={isExpanded}
								onToggleExpand={onToggleExpand}
							/>
						)
					default:
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
			case "ask":
				switch (message.ask) {
					case "tool":
						return (
							<ToolRenderer
								message={message}
								syntaxHighlighterStyle={syntaxHighlighterStyle}
								isExpanded={isExpanded}
								onToggleExpand={onToggleExpand}
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
					case "followup":
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

	if (renderContent() === null) {
		return null
	}
	return <section>{renderContent()}</section>
}

export default React.memo(ChatRow)
