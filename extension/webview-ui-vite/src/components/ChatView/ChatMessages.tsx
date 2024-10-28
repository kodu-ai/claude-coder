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
	handleSendStdin: (text: string) => void
	taskId: number
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
	taskId,
	visibleMessages,
	syntaxHighlighterStyle,
	handleSendStdin,
}) => {
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	// Start with atBottom false to prevent initial auto-scroll
	const [atBottom, setAtBottom] = useState(false)
	const [userScrolled, setUserScrolled] = useState(false)
	const lastMessageCountRef = useRef(visibleMessages.length)
	const isInitialMount = useRef(true)

	const scrollToBottom = useCallback(() => {
		virtuosoRef.current?.scrollToIndex({
			index: "LAST",
			behavior: "auto",
			align: "end",
		})
		setUserScrolled(false)
	}, [])

	const followOutput = useCallback(() => {
		// Only follow if not initial mount and conditions are met
		if (!isInitialMount.current && atBottom && !userScrolled) {
			return "smooth"
		}
		return false
	}, [atBottom, userScrolled])

	const handleScroll = useCallback((event: Event) => {
		if (event.isTrusted) {
			setUserScrolled(true)
			isInitialMount.current = false
		}
	}, [])

	const handleAtBottomStateChange = useCallback((bottom: boolean) => {
		setAtBottom(bottom)
	}, [])

	useEffect(() => {
		const newMessageCount = visibleMessages.length
		const messageAdded = newMessageCount > lastMessageCountRef.current

		if (!isInitialMount.current && atBottom && messageAdded && !userScrolled) {
			console.log("Scrolling to bottom")
			virtuosoRef.current?.scrollToIndex({
				index: newMessageCount - 1,
				behavior: "smooth",
				align: "end",
			})
		}

		lastMessageCountRef.current = newMessageCount
	}, [visibleMessages, atBottom, userScrolled])

	// Reset initial mount flag when taskId changes
	useEffect(() => {
		isInitialMount.current = true
	}, [taskId])

	return (
		<div className="relative h-full">
			<Virtuoso
				ref={virtuosoRef}
				data={visibleMessages}
				followOutput={followOutput}
				initialTopMostItemIndex={0} // Start at top
				atBottomStateChange={handleAtBottomStateChange}
				atBottomThreshold={24}
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
					<div key={message.ts}>
						{isV1ClaudeMessage(message) ? (
							<ChatRowV1
								message={message}
								syntaxHighlighterStyle={syntaxHighlighterStyle}
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
								message={message}
								syntaxHighlighterStyle={syntaxHighlighterStyle}
								isLast={index === visibleMessages.length - 1}
								nextMessage={
									index < visibleMessages.length - 1 ? visibleMessages[index + 1] : undefined
								}
								handleSendStdin={handleSendStdin}
							/>
						)}
					</div>
				)}
			/>
			{!atBottom && (
				<Button
					id="scroll-to-bottom"
					onClick={scrollToBottom}
					size="icon"
					variant="secondary"
					className="fixed bottom-36 right-4 rounded-full"
					aria-label="Scroll to bottom">
					<ChevronDown size={24} />
				</Button>
			)}
		</div>
	)
}

export default ChatMessages
