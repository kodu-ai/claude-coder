import React, { useRef, useEffect } from "react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import { ClaudeMessage, isV1ClaudeMessage, V1ClaudeMessage } from "../../../../src/shared/ExtensionMessage"
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import ChatRow from "../ChatRow/ChatRow"
import ChatRowV1 from "../ChatRow/ChatRowV1"
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom"

interface ChatMessagesProps {
	visibleMessages: ClaudeMessage[]
	syntaxHighlighterStyle: SyntaxHighlighterStyle
	expandedRows: Record<number, boolean>
	toggleRowExpansion: (ts: number) => void
	handleSendStdin: (text: string) => void
	taskId: number
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
	taskId,
	visibleMessages,
	syntaxHighlighterStyle,
	expandedRows,
	toggleRowExpansion,
	handleSendStdin,
}) => {
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>()
	useEffect(() => {
		const timer = setTimeout(() => {
			virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "smooth" })
		}, 50)

		return () => clearTimeout(timer)
	}, [taskId])

	return (
		<Virtuoso
			ref={virtuosoRef}
			className="scrollable"
			style={{
				flexGrow: 1,
				overflowY: "scroll",
			}}
			increaseViewportBy={{ top: 0, bottom: Number.MAX_SAFE_INTEGER }}
			data={visibleMessages ?? []}
			itemContent={(index, message) => (
				<>
					{isV1ClaudeMessage(message) ? (
						<ChatRowV1
							key={message.ts}
							message={message}
							syntaxHighlighterStyle={syntaxHighlighterStyle}
							isExpanded={expandedRows[message.ts] || false}
							onToggleExpand={() => toggleRowExpansion(message.ts)}
							isLast={index === visibleMessages.length - 1}
							handleSendStdin={handleSendStdin}
							nextMessage={
								index < visibleMessages.length - 1
									? (visibleMessages[index + 1] as V1ClaudeMessage)
									: undefined
							}
						/>
					) : (
						<ChatRow
							key={message.ts}
							message={message}
							syntaxHighlighterStyle={syntaxHighlighterStyle}
							isExpanded={expandedRows[message.ts] || false}
							onToggleExpand={() => toggleRowExpansion(message.ts)}
							isLast={index === visibleMessages.length - 1}
							nextMessage={index < visibleMessages.length - 1 ? visibleMessages[index + 1] : undefined}
							handleSendStdin={handleSendStdin}
						/>
					)}
					<div ref={messagesEndRef} id="end" className="shrink-0 min-w-[24px] min-h-[24px]" />
				</>
			)}
		/>
	)
}

export default React.memo(ChatMessages)
