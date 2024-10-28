import { ChatState } from "@/components/chat-view/chat"
import { useState, useCallback } from "react"

export const useChatState = () => {
	const [state, setState] = useState<ChatState>({
		inputValue: "",
		textAreaDisabled: false,
		selectedImages: [],
		thumbnailsHeight: 0,
		claudeAsk: undefined,
		enableButtons: false,
		primaryButtonText: undefined,
		secondaryButtonText: undefined,
		expandedRows: {},
		isAbortingRequest: false,
	})

	const updateState = useCallback((updates: Partial<ChatState>) => {
		setState((prev) => ({ ...prev, ...updates }))
	}, [])

	return { state, updateState }
}
