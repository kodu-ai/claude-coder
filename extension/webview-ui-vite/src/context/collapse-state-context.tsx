import React, { createContext, useState, useCallback } from "react"
import { ClaudeMessage, isV1ClaudeMessage } from "../../../src/shared/messages/extension-message"

interface CollapseContextType {
	collapsedMessages: Set<number>
	messages: ClaudeMessage[]
	isAllCollapsed: boolean
	toggleCollapse: (messageTs: number) => void
	isCollapsed: (messageTs: number) => boolean
	shouldShowMessage: (message: ClaudeMessage) => boolean
	collapseAll: () => void
	setMessages: (messages: ClaudeMessage[]) => void
}

export const CollapseContext = createContext<CollapseContextType | undefined>(undefined)

export function CollapseProvider({ children }: { children: React.ReactNode }) {
	const [messages, setMessages] = useState<ClaudeMessage[]>([])
	const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set())
	const [isAllCollapsed, setIsAllCollapsed] = useState(false)

	const toggleCollapse = useCallback((messageTs: number) => {
		setCollapsedMessages((prev) => {
			const next = new Set(prev)
			if (next.has(messageTs)) {
				next.delete(messageTs)
			} else {
				next.add(messageTs)
			}
			return next
		})
	}, [])

	const isCollapsed = useCallback(
		(messageTs: number) => {
			return collapsedMessages.has(messageTs)
		},
		[collapsedMessages]
	)

	const shouldShowMessage = useCallback(
		(message: ClaudeMessage) => {
			// Only V1 messages can be collapsed
			if (!isV1ClaudeMessage(message)) {
				return true
			}

			// Always show API request messages
			if (message.say === "api_req_started") {
				return true
			}

			// Find the previous API request message
			const messageIndex = messages.findIndex((m) => m.ts === message.ts)

			// Iterate backwards from current message to find the previous API request
			let previousApiRequest: ClaudeMessage | undefined
			for (let i = messageIndex - 1; i >= 0; i--) {
				const msg = messages[i]
				if (isV1ClaudeMessage(msg) && msg.say === "api_req_started") {
					previousApiRequest = msg
					break
				}
			}

			// If there's no previous API request or it's not collapsed, show the message
			if (!previousApiRequest || !collapsedMessages.has(previousApiRequest.ts)) {
				return true
			}

			// If the previous API request is collapsed, hide this message
			return false
		},
		[messages, collapsedMessages]
	)

	const collapseAll = useCallback(() => {
		if (isAllCollapsed) {
			// Uncollapse all
			setCollapsedMessages(new Set())
			setIsAllCollapsed(false)
		} else {
			// Collapse all API request messages
			setCollapsedMessages(
				new Set(
					messages
						.filter((message) => isV1ClaudeMessage(message) && message.say === "api_req_started")
						.map((message) => message.ts)
				)
			)
			setIsAllCollapsed(true)
		}
	}, [messages, isAllCollapsed])

	const value = {
		collapsedMessages,
		messages,
		isAllCollapsed,
		toggleCollapse,
		isCollapsed,
		shouldShowMessage,
		collapseAll,
		setMessages,
	}

	return <CollapseContext.Provider value={value}>{children}</CollapseContext.Provider>
}
