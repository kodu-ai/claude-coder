import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { type ClaudeMessage, type V1ClaudeMessage, isV1ClaudeMessage } from '../../../../src/shared/ExtensionMessage'
import type { SyntaxHighlighterStyle } from '../../utils/getSyntaxHighlighterStyleFromTheme'
import ChatRow from '../ChatRow/ChatRow'
import ChatRowV1 from '../ChatRow/ChatRowV1'

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

	const followOutput = useCallback((isAtBottom: boolean) => {
		if (isAtBottom) {
			return 'smooth'
		}
		return false
	}, [])

	const handleAtBottomStateChange = useCallback((bottom: boolean) => {
		setAtBottom(bottom)
	}, [])

	useEffect(() => {
		if (atBottom) {
			virtuosoRef.current?.scrollToIndex({
				index: visibleMessages.length - 1,
				behavior: 'smooth',
				align: 'end',
			})
		}
	}, [visibleMessages, atBottom])

	return (
		<Virtuoso
			ref={virtuosoRef}
			data={visibleMessages}
			followOutput={followOutput}
			atBottomStateChange={handleAtBottomStateChange}
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
