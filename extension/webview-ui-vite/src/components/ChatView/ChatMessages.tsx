import React, { useRef, useEffect } from "react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import { ClaudeMessage, isV1ClaudeMessage, V1ClaudeMessage } from "../../../../src/shared/ExtensionMessage"
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import ChatRow from "../ChatRow/ChatRow"
import ChatRowV1 from "../ChatRow/ChatRowV1"

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
			data={visibleMessages ?? []}
			itemContent={(index, message) =>
				// here we will do a version check and render the appropriate component

				// V0
				isV1ClaudeMessage(message) ? (
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
				)
			}
		/>
	)
}

export default React.memo(ChatMessages)
