import React, { useRef, useEffect, useState, useCallback } from "react"
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
	const [atBottom, setAtBottom] = useState(true)
	const [userScrolled, setUserScrolled] = useState(false)

	const followOutput = useCallback(
		(isAtBottom: boolean) => {
			if (isAtBottom && !userScrolled) {
				return "smooth"
			}
			return false
		},
		[userScrolled]
	)

	const handleScroll = useCallback(() => {
		setUserScrolled(true)
	}, [])

	const handleAtBottomStateChange = useCallback((bottom: boolean) => {
		setAtBottom(bottom)
		if (bottom) {
			setUserScrolled(false)
		}
	}, [])

	// Only auto-scroll on new messages if we're at the bottom and user hasn't manually scrolled
	useEffect(() => {
		if (atBottom && !userScrolled) {
			virtuosoRef.current?.scrollToIndex({
				index: visibleMessages.length - 1,
				behavior: "smooth",
				align: "end",
			})
		}
	}, [visibleMessages, atBottom, userScrolled])

	return (
		<Virtuoso
			ref={virtuosoRef}
			data={visibleMessages}
			followOutput={followOutput}
			atBottomStateChange={handleAtBottomStateChange}
			atBottomThreshold={2}
			scrollerRef={(ref) => {
				if (ref) {
					ref.addEventListener("wheel", handleScroll)
					ref.addEventListener("touchmove", handleScroll)
					return () => {
						ref.removeEventListener("wheel", handleScroll)
						ref.removeEventListener("touchmove", handleScroll)
					}
				}
			}}
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
				</>
			)}
		/>
	)
}

export default React.memo(ChatMessages)
