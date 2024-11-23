import React, { useRef, useEffect, useState, useCallback, useMemo } from "react"
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
        syntaxHighlighterStyle,
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
                message={message}
                syntaxHighlighterStyle={syntaxHighlighterStyle}
                isLast={isLast}
                nextMessage={nextMessage as V1ClaudeMessage | undefined}
            />
        ) : (
            <ChatRow
                message={message}
                syntaxHighlighterStyle={syntaxHighlighterStyle}
                isLast={isLast}
                nextMessage={nextMessage}
            />
        )
    }
)

MessageRenderer.displayName = "MessageRenderer"

const ChatMessages: React.FC<ChatMessagesProps> = ({ taskId, visibleMessages, syntaxHighlighterStyle }) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null)
    const [atBottom, setAtBottom] = useState(true)
    const [userScrolled, setUserScrolled] = useState(false)
    const lastMessageCountRef = useRef(visibleMessages.length)
    const isInitialMount = useRef(true)
    const scrollTimeoutRef = useRef<NodeJS.Timeout>()

    // Progressive loading state
    const [visibleRange, setVisibleRange] = useState({ startIndex: 0, endIndex: 0 })
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const loadingTimeoutRef = useRef<NodeJS.Timeout>()

    // Optimize message rendering with windowing
    const getItemsPerPage = (totalTokens: number): number => {
        if (totalTokens > 50000) return 5
        if (totalTokens > 10000) return 10
        return 20
    }

    // Calculate total tokens in messages
    const getTotalTokens = useCallback((messages: ClaudeMessage[]): number => {
        return messages.reduce((total, msg) => {
            // Rough estimation of tokens
            return total + (msg.text?.length || 0) / 4
        }, 0)
    }, [])

    // Handle range changes for progressive loading
    const handleRangeChange = useCallback((range: { startIndex: number; endIndex: number }) => {
        setVisibleRange(range)

        // Clear any pending loading timeout
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current)
        }

        // Set loading state with debounce
        loadingTimeoutRef.current = setTimeout(() => {
            setIsLoadingMore(true)
            // Simulate progressive loading delay
            setTimeout(() => setIsLoadingMore(false), 100)
        }, 150)
    }, [])

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

        if (!isInitialMount.current && messageAdded) {
            // More aggressive scroll behavior for new messages
            if (!userScrolled || atBottom) {
                scrollToBottom("smooth")
            }
        }

        lastMessageCountRef.current = newMessageCount
    }, [visibleMessages.length, atBottom, userScrolled, scrollToBottom])

    // Reset state when task changes
    useEffect(() => {
        isInitialMount.current = true
        setUserScrolled(false)
        setAtBottom(true)
        lastMessageCountRef.current = visibleMessages.length
        // Ensure we start at bottom for new tasks
        setTimeout(() => scrollToBottom(), 0)
    }, [taskId, visibleMessages.length, scrollToBottom])

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

    // Memoize item content renderer with progressive loading
    const itemContent = useCallback(
        (index: number, message: ClaudeMessage) => {
            const totalTokens = getTotalTokens(visibleMessages)
            const isVisible = index >= visibleRange.startIndex && index <= visibleRange.endIndex

            if (!isVisible && totalTokens > 10000) {
                // Return placeholder for non-visible items
                return (
                    <div key={`list-item-${message.ts}`} className="mb-0 h-[50px] animate-pulse bg-muted/10 rounded" />
                )
            }

            return (
                <div key={`list-item-${message.ts}`} className="mb-0">
                    <MessageRenderer
                        message={message}
                        index={index}
                        total={visibleMessages.length}
                        syntaxHighlighterStyle={syntaxHighlighterStyle}
                        nextMessage={index < visibleMessages.length - 1 ? visibleMessages[index + 1] : undefined}
                    />
                </div>
            )
        },
        [visibleMessages, syntaxHighlighterStyle, visibleRange, getTotalTokens]
    )

    return (
        <div className="relative overflow-hidden h-full flex flex-col flex-1">
            <Virtuoso
                key={`virtuoso-${taskId}`}
                ref={virtuosoRef}
                data={visibleMessages.filter((message) => {
                    if (
                        message.say === "shell_integration_warning" ||
                        (message.text?.length ?? 0) > 0 ||
                        (message.images?.length ?? 0) > 0
                    ) {
                        return true
                    }
                    return false
                })}
                style={{ height: "100%" }}
                followOutput={followOutput}
                initialTopMostItemIndex={{
                    index: "LAST",
                    behavior: "smooth",
                    align: "end",
                }}
                rangeChanged={handleRangeChange}
                atBottomStateChange={handleAtBottomStateChange}
                atBottomThreshold={SCROLL_THRESHOLD}
                scrollerRef={scrollerRefCallback}
                itemContent={itemContent}
                overscan={20} // Reduced overscan for better performance
                increaseViewportBy={{ top: 200, bottom: 200 }} // Reduced viewport buffer
                defaultItemHeight={100} // More conservative default height
                components={{
                    Header: () => isLoadingMore ? (
                        <div className="py-2 text-center text-sm text-muted-foreground">
                            Loading more messages...
                        </div>
                    ) : null
                }}
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

// Memoize the entire component
export default React.memo(ChatMessages, (prevProps, nextProps) => {
    return (
        prevProps.taskId === nextProps.taskId &&
        prevProps.visibleMessages === nextProps.visibleMessages &&
        prevProps.syntaxHighlighterStyle === nextProps.syntaxHighlighterStyle
    )
})
