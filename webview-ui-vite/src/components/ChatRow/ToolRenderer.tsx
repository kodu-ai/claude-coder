import React from "react"
import { ClaudeMessage, ClaudeSayTool } from "../../../../src/shared/ExtensionMessage"
import CodeBlock from "../CodeBlock/CodeBlock"
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import { Loader2 } from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface ToolRendererProps {
	message: ClaudeMessage
	syntaxHighlighterStyle: SyntaxHighlighterStyle
	isExpanded: boolean
	onToggleExpand: () => void
	nextMessage?: ClaudeMessage
}

const WebSearchTool: React.FC<ToolRendererProps> = ({
	message,
	syntaxHighlighterStyle,
	isExpanded,
	onToggleExpand,
	nextMessage,
}) => {
	const { claudeMessages } = useExtensionState()
	const tool = JSON.parse(message.text || "{}") as ClaudeSayTool
	const toolIcon = (name: string) => <span className={`codicon codicon-${name} text-alt`} />
	const lastMessage = claudeMessages[claudeMessages.length - 1]
	const lastMessageText = lastMessage?.text
	if (tool.tool !== "web_search") return null

	return (
		<>
			<h3 className="text-alt items-center flex gap-1.5">
				{lastMessage.text === message.text ? <Loader2 className="animate-spin size-4" /> : toolIcon("search")}
				{/* {toolIcon("search")} */}
				{message.type === "ask" ? <>Claude wants to search the web for</> : <>Claude searched the web for</>}
			</h3>
			<CodeBlock
				code={tool.query}
				path={tool.baseLink}
				language="plaintext"
				syntaxHighlighterStyle={syntaxHighlighterStyle}
				isExpanded={isExpanded}
				onToggleExpand={onToggleExpand}
			/>
		</>
	)
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
