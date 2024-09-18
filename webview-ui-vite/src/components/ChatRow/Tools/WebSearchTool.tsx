import React from "react"
import { ClaudeSayTool } from "../../../../../src/shared/ExtensionMessage"
import CodeBlock from "../../CodeBlock/CodeBlock"
import { ToolRendererProps } from "../ToolRenderer"
import { Loader2 } from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"

export const WebSearchTool: React.FC<ToolRendererProps> = ({
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
