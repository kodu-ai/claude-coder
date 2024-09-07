import React, { useRef, useEffect } from "react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import { ClaudeMessage } from "../../../../src/shared/ExtensionMessage"
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import ChatRow from "../ChatRow/ChatRow"

interface ChatMessagesProps {
	visibleMessages: ClaudeMessage[]
	syntaxHighlighterStyle: SyntaxHighlighterStyle
	expandedRows: Record<number, boolean>
	toggleRowExpansion: (ts: number) => void
	handleSendStdin: (text: string) => void
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
	visibleMessages,
	syntaxHighlighterStyle,
	expandedRows,
	toggleRowExpansion,
	handleSendStdin,
}) => {
	const virtuosoRef = useRef<VirtuosoHandle>(null)

	useEffect(() => {
		const timer = setTimeout(() => {
			virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "smooth" })
		}, 50)
		console.log(JSON.stringify(visibleMessages, null, 2))

		return () => clearTimeout(timer)
	}, [visibleMessages])

	return (
		<Virtuoso
			ref={virtuosoRef}
			className="scrollable"
			style={{
				flexGrow: 1,
				overflowY: "scroll",
			}}
			increaseViewportBy={{ top: 0, bottom: Number.MAX_SAFE_INTEGER }}
			data={visibleMessages}
			itemContent={(index, message) => (
				<ChatRow
					key={message.ts}
					message={message}
					syntaxHighlighterStyle={syntaxHighlighterStyle}
					isExpanded={expandedRows[message.ts] || false}
					onToggleExpand={() => toggleRowExpansion(message.ts)}
					isLast={index === visibleMessages.length - 1}
					lastModifiedMessage={visibleMessages?.at(index + 1)}
					handleSendStdin={handleSendStdin}
				/>
			)}
		/>
	)
}

export default ChatMessages
