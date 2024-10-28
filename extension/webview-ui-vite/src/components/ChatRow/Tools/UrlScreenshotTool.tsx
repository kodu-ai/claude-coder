import React from "react"
import { ClaudeSayTool } from "../../../../../src/shared/ExtensionMessage"
import CodeBlock from "../../CodeBlock/CodeBlock"
import { ToolRendererProps } from "../ToolRenderer"
import { Loader2 } from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"

export const UrlScreenshotTool: React.FC<ToolRendererProps> = ({ message, syntaxHighlighterStyle }) => {
	const tool = JSON.parse(message.text || "{}") as ClaudeSayTool
	const { claudeMessages } = useExtensionState()
	const [isExpanded, setIsExpanded] = React.useState(false)
	const onToggleExpand = () => setIsExpanded(!isExpanded)
	if (tool.tool !== "url_screenshot") return null

	const toolIcon = (name: string) => <span className={`codicon codicon-${name} text-alt`} />
	const lastMessage = claudeMessages[claudeMessages.length - 1]

	return (
		<>
			<h3 className="text-alt items-center flex gap-1.5">
				{lastMessage.text === message.text ? (
					<Loader2 className="animate-spin size-4" />
				) : (
					toolIcon("device-camera")
				)}
				{message.type === "ask" ? (
					<>Claude wants to take a screenshot of the url</>
				) : (
					<>Claude took a screenshot of the url</>
				)}
			</h3>

			{tool.base64Image ? (
				<div style={{ maxHeight: "300px", width: "100%", overflow: "hidden" }}>
					<img
						src={`data:image/jpeg;base64,${tool.base64Image}`}
						style={{ width: "100%", objectFit: "cover" }}
					/>
				</div>
			) : (
				<CodeBlock
					code={tool.url}
					language="plaintext"
					syntaxHighlighterStyle={syntaxHighlighterStyle}
					isExpanded={isExpanded}
					onToggleExpand={onToggleExpand}
				/>
			)}
		</>
	)
}
