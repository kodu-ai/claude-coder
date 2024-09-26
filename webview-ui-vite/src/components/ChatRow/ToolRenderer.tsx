import React from "react"
import { ClaudeMessage, ClaudeSayTool } from "../../../../src/shared/ExtensionMessage"
import CodeBlock from "../CodeBlock/CodeBlock"
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import { AskConsultantTool, UrlScreenshotTool, WebSearchTool } from "./Tools"

export interface ToolRendererProps {
	message: ClaudeMessage
	syntaxHighlighterStyle: SyntaxHighlighterStyle
	isExpanded: boolean
	onToggleExpand: () => void
	nextMessage?: ClaudeMessage
}

const ToolRenderer: React.FC<ToolRendererProps> = ({
	message,
	syntaxHighlighterStyle,
	isExpanded,
	onToggleExpand,
	nextMessage,
}) => {
	const tool = JSON.parse(message.text || "{}") as ClaudeSayTool
	const toolIcon = (name: string) => <span className={`codicon codicon-${name} text-alt`} />

	switch (tool.tool) {
		case "editedExistingFile":
			return (
				<>
					<div className="flex-line">
						{toolIcon("edit")}
						<h3 className="text-alt">Claude wants to edit this file:</h3>
					</div>
					<CodeBlock
						diff={tool.diff!}
						path={tool.path!}
						syntaxHighlighterStyle={syntaxHighlighterStyle}
						isExpanded={isExpanded}
						onToggleExpand={onToggleExpand}
					/>
				</>
			)
		case "newFileCreated":
			return (
				<>
					<h3 className="flex-line text-alt">{toolIcon("new-file")}Claude wants to create a new file:</h3>
					<CodeBlock
						code={tool.content!}
						path={tool.path!}
						syntaxHighlighterStyle={syntaxHighlighterStyle}
						isExpanded={isExpanded}
						onToggleExpand={onToggleExpand}
					/>
				</>
			)
		case "readFile":
			return (
				<>
					<h3 className="flex-line text-alt">
						{toolIcon("file-code")}
						{message.type === "ask" ? "Claude wants to read this file:" : "Claude read this file:"}
					</h3>
					<CodeBlock
						code={tool.content!}
						path={tool.path!}
						syntaxHighlighterStyle={syntaxHighlighterStyle}
						isExpanded={isExpanded}
						onToggleExpand={onToggleExpand}
					/>
				</>
			)
		case "listFilesTopLevel":
			return (
				<>
					<h3 className="flex-line text-alt">
						{toolIcon("folder-opened")}
						{message.type === "ask"
							? "Claude wants to view the top level files in this directory:"
							: "Claude viewed the top level files in this directory:"}
					</h3>
					<CodeBlock
						code={tool.content!}
						path={tool.path!}
						language="shell-session"
						syntaxHighlighterStyle={syntaxHighlighterStyle}
						isExpanded={isExpanded}
						onToggleExpand={onToggleExpand}
					/>
				</>
			)
		case "listFilesRecursive":
			return (
				<>
					<h3 className="flex-line text-alt">
						{toolIcon("folder-opened")}
						{message.type === "ask"
							? "Claude wants to recursively view all files in this directory:"
							: "Claude recursively viewed all files in this directory:"}
					</h3>
					<CodeBlock
						code={tool.content!}
						path={tool.path!}
						language="shell-session"
						syntaxHighlighterStyle={syntaxHighlighterStyle}
						isExpanded={isExpanded}
						onToggleExpand={onToggleExpand}
					/>
				</>
			)
		case "listCodeDefinitionNames":
			return (
				<>
					<h3 className="flex-line text-alt">
						{toolIcon("file-code")}
						{message.type === "ask"
							? "Claude wants to view source code definition names used in this directory:"
							: "Claude viewed source code definition names used in this directory:"}
					</h3>
					{/* <CodeBlock
						code={tool.content!}
						path={tool.path!}
						syntaxHighlighterStyle={syntaxHighlighterStyle}
						isExpanded={isExpanded}
						onToggleExpand={onToggleExpand}
					/> */}
				</>
			)

		case "web_search":
			console.log(nextMessage)
			return (
				<WebSearchTool
					message={message}
					syntaxHighlighterStyle={syntaxHighlighterStyle}
					isExpanded={isExpanded}
					onToggleExpand={onToggleExpand}
					nextMessage={nextMessage}
				/>
			)

		case "url_screenshot":
			return (
				<UrlScreenshotTool
					message={message}
					syntaxHighlighterStyle={syntaxHighlighterStyle}
					isExpanded={isExpanded}
					onToggleExpand={onToggleExpand}
					nextMessage={nextMessage}
				/>
			)

		case "ask_consultant":
			return (
				<AskConsultantTool
					message={message}
					syntaxHighlighterStyle={syntaxHighlighterStyle}
					isExpanded={isExpanded}
					onToggleExpand={onToggleExpand}
				/>
			)

		case "searchFiles":
			return (
				<>
					<h3 className="text-alt">
						{toolIcon("search")}
						{message.type === "ask" ? (
							<>
								Claude wants to search this directory for <code>{tool.regex}</code>:
							</>
						) : (
							<>
								Claude searched this directory for <code>{tool.regex}</code>:
							</>
						)}
					</h3>
					<CodeBlock
						code={tool.content!}
						path={tool.path! + (tool.filePattern ? `/(${tool.filePattern})` : "")}
						language="plaintext"
						syntaxHighlighterStyle={syntaxHighlighterStyle}
						isExpanded={isExpanded}
						onToggleExpand={onToggleExpand}
					/>
				</>
			)
		default:
			return null
	}
}

export default ToolRenderer
