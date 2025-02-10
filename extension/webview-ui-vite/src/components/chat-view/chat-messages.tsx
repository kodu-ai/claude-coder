import React, { useRef, useEffect, useState, useCallback, useMemo } from "react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import { ChevronDown } from "lucide-react"
import { useCollapseState } from "@/hooks/use-collapse-state"
import { ClaudeMessage, isV1ClaudeMessage, V1ClaudeMessage } from "extension/shared/messages/extension-message"
import { SyntaxHighlighterStyle } from "../../utils/get-syntax-highlighter-style-from-theme"
import ChatRowV1 from "../chat-row/chat-row"
import { Button } from "../ui/button"

const isActionTag = (txt: string) => txt.trim().startsWith("<kodu_action>") || txt.trim().startsWith("</kodu_action>")

interface ChatMessagesProps {
	visibleMessages: ClaudeMessage[]
	syntaxHighlighterStyle: SyntaxHighlighterStyle
	taskId: number
}

// Increased threshold for better bottom detection
const SCROLL_THRESHOLD = 33
const SCROLL_DEBOUNCE = 1

// Memoized message renderer component
const MessageRenderer = React.memo(
	({
		message,
		index,
		total,
		nextMessage,
	}: {
		message: ClaudeMessage
		index: number
		total: number
		syntaxHighlighterStyle: SyntaxHighlighterStyle
		nextMessage?: ClaudeMessage
	}) => {
		const isLast = index === total - 1

		return isV1ClaudeMessage(message) ? (
			<ChatRowV1
				isFirst={index === 0}
				message={message}
				isLast={isLast}
				nextMessage={nextMessage as V1ClaudeMessage | undefined}
			/>
		) : (
			<div>Deprecated Message Type</div>
		)
	}
)

MessageRenderer.displayName = "MessageRenderer"

const ChatMessages: React.FC<ChatMessagesProps> = ({ taskId, visibleMessages, syntaxHighlighterStyle }) => {
	const { shouldShowMessage, setMessages } = useCollapseState()

	// Keep collapse context messages in sync
	useEffect(() => {
		setMessages(visibleMessages)
	}, [visibleMessages, setMessages])
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const [atBottom, setAtBottom] = useState(true)
	const [userScrolled, setUserScrolled] = useState(false)
	const lastMessageCountRef = useRef(visibleMessages.length)
	const isInitialMount = useRef(true)
	const scrollTimeoutRef = useRef<NodeJS.Timeout>()

	// Memoize scroll handlers to prevent recreating on every render
	const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
		if (virtuosoRef.current) {
			virtuosoRef.current.scrollToIndex({
				index: "LAST",
				behavior: behavior === "auto" ? "auto" : "smooth",
				align: "end",
			})
			setUserScrolled(false)
			setAtBottom(true)
		}
	}, [])

	const followOutput = useCallback(() => {
		// More aggressive auto-scroll behavior
		if (!userScrolled || atBottom) {
			return "smooth"
		}
		return false
	}, [atBottom, userScrolled])

	// Debounced scroll handler
	const handleScroll = useCallback((event: Event) => {
		if (!event.isTrusted) return

		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current)
		}

		scrollTimeoutRef.current = setTimeout(() => {
			setUserScrolled(true)
			isInitialMount.current = false
		}, SCROLL_DEBOUNCE)
	}, [])

	const handleAtBottomStateChange = useCallback((bottom: boolean) => {
		setAtBottom(bottom)
		if (bottom) {
			setUserScrolled(false)
		}
	}, [])

	// Handle new messages
	useEffect(() => {
		const newMessageCount = visibleMessages.length
		const messageAdded = newMessageCount > lastMessageCountRef.current

		if (messageAdded) {
			// Only scroll if we're at the bottom when new content arrives
			if (atBottom) {
				scrollToBottom("smooth")
			}
		}

		lastMessageCountRef.current = newMessageCount
	}, [visibleMessages.length, atBottom, scrollToBottom])

	// Reset state and scroll to bottom only on first render for new taskId
	useEffect(() => {
		isInitialMount.current = true
		setUserScrolled(false)
		setAtBottom(true)
		lastMessageCountRef.current = visibleMessages.length
		// Ensure we start at bottom for new tasks
		scrollToBottom()
	}, [taskId, scrollToBottom]) // Remove visibleMessages.length dependency

	// Cleanup
	useEffect(() => {
		return () => {
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current)
			}
		}
	}, [])

	// Memoize scroll event handlers setup
	const scrollerRefCallback = useCallback(
		(ref: HTMLElement | Window | null) => {
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
			return
		},
		[handleScroll]
	)

	// Memoize item content renderer
	const itemContent = useCallback(
		(index: number, message: ClaudeMessage) => (
			<div key={`list-item-${message.ts}`} className="mb-0">
				<MessageRenderer
					message={message}
					index={index}
					total={visibleMessages.length}
					syntaxHighlighterStyle={syntaxHighlighterStyle}
					nextMessage={index < visibleMessages.length - 1 ? visibleMessages[index + 1] : undefined}
				/>
			</div>
		),
		[visibleMessages, syntaxHighlighterStyle]
	)

	return (
		<div className="relative overflow-hidden h-full flex flex-col flex-1 ">
			<Virtuoso
				key={`virtuoso-${taskId}`}
				ref={virtuosoRef}
				data={useMemo(() => {
					return visibleMessages.filter((message) => {
						if (message.text) {
							message.text = message.text?.trim() ?? ""
						}

						// First apply existing filters
						const passesBasicFilters =
							(message.say === "shell_integration_warning" ||
								message.say === "api_req_started" ||
								message.say === "hook" ||
								message.say === "chat_truncated" ||
								(message.text?.length ?? 0) > 0 ||
								(message.images?.length ?? 0) > 0) &&
							!isActionTag(message.text ?? "")

						// Then check collapse state
						return passesBasicFilters && shouldShowMessage(message)
					})
				}, [visibleMessages, shouldShowMessage])}
				style={{ height: "100%" }}
				followOutput={followOutput}
				atBottomStateChange={handleAtBottomStateChange}
				atBottomThreshold={SCROLL_THRESHOLD}
				scrollerRef={scrollerRefCallback}
				itemContent={itemContent}
				overscan={50}
				increaseViewportBy={{ top: 400, bottom: 400 }}
				// alignToBottom
				defaultItemHeight={400}
			/>
			{!atBottom && userScrolled && (
				<Button
					id="scroll-to-bottom"
					onClick={() => scrollToBottom("smooth")}
					size="icon"
					variant="secondary"
					className="fixed bottom-36 right-4 rounded-full shadow-lg hover:shadow-xl transition-shadow"
					aria-label="Scroll to bottom">
					<ChevronDown size={24} />
				</Button>
			)}
		</div>
	)
}

export default ChatMessages
