import React, { useRef, useEffect, useState, useCallback } from "react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import { ChevronDown } from "lucide-react"
import { ClaudeMessage, isV1ClaudeMessage, V1ClaudeMessage } from "../../../../src/shared/ExtensionMessage"
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import ChatRow from "../ChatRow/ChatRow"
import ChatRowV1 from "../ChatRow/ChatRowV1"
import { Button } from "../ui/button"

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
	const lastMessageCountRef = useRef(visibleMessages.length)

	const scrollToBottom = useCallback(() => {
		virtuosoRef.current?.scrollToIndex({
			index: "LAST",
			behavior: "auto",
			align: "end",
		})
		setUserScrolled(false)
	}, [visibleMessages.length])

	const followOutput = useCallback(() => {
		if (atBottom && !userScrolled) {
			return "smooth"
		}
		return false
	}, [atBottom, userScrolled])

	const handleScroll = useCallback((event: Event) => {
		if (event.isTrusted) {
			setUserScrolled(true)
		}
	}, [])

	const handleAtBottomStateChange = useCallback((bottom: boolean) => {
		console.log("bottom", bottom)
		setAtBottom(bottom)
	}, [])

	useEffect(() => {
		const newMessageCount = visibleMessages.length
		const messageAdded = newMessageCount > lastMessageCountRef.current

		if (atBottom && messageAdded && !userScrolled) {
			virtuosoRef.current?.scrollToIndex({
				index: newMessageCount - 1,
				behavior: "smooth",
				align: "end",
			})
		}

		lastMessageCountRef.current = newMessageCount
	}, [visibleMessages, atBottom, userScrolled])

	return (
		<div className="relative h-full">
			<Virtuoso
				ref={virtuosoRef}
				data={visibleMessages}
				followOutput={followOutput}
				atBottomStateChange={handleAtBottomStateChange}
				atBottomThreshold={16}
				scrollerRef={(ref) => {
					if (ref) {
						ref.addEventListener("wheel", handleScroll)
						ref.addEventListener("touchmove", handleScroll)
						ref.addEventListener("keydown", handleScroll)
						return () => {
							ref.removeEventListener("wheel", handleScroll)
							ref.removeEventListener("touchmove", handleScroll)
							ref.removeEventListener("keydown", handleScroll)
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
								nextMessage={
									index < visibleMessages.length - 1 ? visibleMessages[index + 1] : undefined
								}
								handleSendStdin={handleSendStdin}
							/>
						)}
					</>
				)}
			/>
			{!atBottom && (
				<Button
					id="scroll-to-bottom"
					onClick={scrollToBottom}
					size="icon"
					variant="secondary"
					className="fixed bottom-48 right-4 rounded-full"
					aria-label="Scroll to bottom">
					<ChevronDown size={24} />
				</Button>
			)}
		</div>
	)
}

export default React.memo(ChatMessages)
