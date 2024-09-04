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
	lastModifiedMessage?: ClaudeMessage
	isLast: boolean
	handleSendStdin: (text: string) => void
}

const ChatRow: React.FC<ChatRowProps> = ({
	message,
	syntaxHighlighterStyle,
	isExpanded,
	onToggleExpand,
	lastModifiedMessage,
	isLast,
	handleSendStdin,
}) => {
	const cost = message.text != null && message.say === "api_req_started" ? JSON.parse(message.text).cost : undefined
	const apiRequestFailedMessage =
		isLast && lastModifiedMessage?.ask === "api_req_failed" ? lastModifiedMessage?.text : undefined
	const isCommandExecuting = !!(
		isLast &&
		lastModifiedMessage?.ask === "command" &&
		lastModifiedMessage?.text?.includes(COMMAND_OUTPUT_STRING)
	)

	const renderContent = () => {
		const [icon, title] = IconAndTitle({
			type: message.type === "ask" ? message.ask : message.say,
			isCommandExecuting,
			cost,
			apiRequestFailedMessage,
		})

		switch (message.type) {
			case "say":
				switch (message.say) {
					case "api_req_started":
						return (
							<>
								<div className="flex-line">
									{icon}
									{title}
									{cost && <code className="text-light">${Number(cost)?.toFixed(4)}</code>}
									<div className="flex-1" />
									<VSCodeButton
										appearance="icon"
										aria-label="Toggle Details"
										onClick={onToggleExpand}>
										<span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`} />
									</VSCodeButton>
								</div>
								{cost == null && apiRequestFailedMessage && (
									<div className="text-error">{apiRequestFailedMessage}</div>
								)}
							</>
						)
					case "api_req_finished":
						return null
					case "text":
						return (
							<MarkdownRenderer
								markdown={message.text || ""}
								syntaxHighlighterStyle={syntaxHighlighterStyle}
							/>
						)
					case "user_feedback":
						return (
							<div style={{ display: "flex", alignItems: "start", gap: "8px" }}>
								<span className="codicon codicon-account" style={{ marginTop: "2px" }} />
								<div style={{ display: "grid", gap: "8px" }}>
									<div>{message.text}</div>
									{message.images && message.images.length > 0 && (
										<Thumbnails images={message.images} />
									)}
								</div>
							</div>
						)
					case "user_feedback_diff":
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
					case "error":
						return (
							<>
								{title && (
									<h3 className="flex-line text-error">
										{icon}
										{title}
									</h3>
								)}
								<p>{message.text}</p>
							</>
						)
					case "completion_result":
						return (
							<>
								<h3 className="flex-line text-success">
									{icon}
									{title}
								</h3>
								<div className="text-success">
									<MarkdownRenderer
										markdown={message.text || ""}
										syntaxHighlighterStyle={syntaxHighlighterStyle}
									/>
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
						return (
							<>
								{title && (
									<h3 className="flex-line">
										{icon}
										{title}
									</h3>
								)}
								<MarkdownRenderer
									markdown={message.text || ""}
									syntaxHighlighterStyle={syntaxHighlighterStyle}
								/>
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
					case "completion_result":
						if (message.text) {
							return (
								<>
									<h3 className="flex-line">
										{icon}
										{title}
									</h3>
									<div className="text-success">
										<MarkdownRenderer
											markdown={message.text}
											syntaxHighlighterStyle={syntaxHighlighterStyle}
										/>
									</div>
								</>
							)
						} else {
							return null
						}
					case "followup":
						return (
							<>
								{title && (
									<h3 className="flex-line">
										{icon}
										{title}
									</h3>
								)}
								<MarkdownRenderer
									markdown={message.text || ""}
									syntaxHighlighterStyle={syntaxHighlighterStyle}
								/>
							</>
						)
				}
		}
	}

	return (
		<section>
			{renderContent()}
			{isExpanded && message.say === "api_req_started" && (
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
		</section>
	)
}

export default ChatRow
