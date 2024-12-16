import { vscode } from "@/utils/vscode"
import React, { memo, useCallback, useRef, useEffect, KeyboardEvent } from "react"
import InputArea from "./input-area"
import { ChatState } from "./chat"

interface ChatInputProps {
	state: ChatState
	updateState: (updates: Partial<ChatState>) => void
	onSendMessage: (text?: string) => void
	shouldDisableImages: boolean
	handlePaste: (e: React.ClipboardEvent) => void
	isRequestRunning: boolean
	isInTask: boolean
	isHidden: boolean
}

export const ChatInput = memo(function ChatInput({
	state,
	updateState,
	onSendMessage,
	shouldDisableImages,
	handlePaste,
	isRequestRunning,
	isInTask,
	isHidden,
}: ChatInputProps) {
	const textAreaRef = useRef<HTMLTextAreaElement>(null)

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			const isComposing = event.nativeEvent?.isComposing ?? false
			if (event.key === "Enter" && !event.shiftKey && !isComposing) {
				event.preventDefault()
				onSendMessage()
			}
		},
		[onSendMessage]
	)

	useEffect(() => {
		const timer = setTimeout(() => {
			if (!isHidden && !state.textAreaDisabled && !state.enableButtons) {
				textAreaRef.current?.focus()
			}
		}, 50)
		return () => clearTimeout(timer)
	}, [isHidden, state.textAreaDisabled, state.enableButtons])

	return (
		<InputArea
			inputRef={textAreaRef}
			inputValue={state.inputValue}
			setInputValue={(value) => updateState({ inputValue: value })}
			textAreaDisabled={state.textAreaDisabled}
			handleSendMessage={onSendMessage}
			placeholderText={isInTask ? "Type a message..." : "Type your task here..."}
			selectedImages={state.selectedImages}
			setSelectedImages={(images) => updateState({ selectedImages: images })}
			shouldDisableImages={shouldDisableImages}
			selectImages={() => vscode.postMessage({ type: "selectImages" })}
			thumbnailsHeight={state.thumbnailsHeight}
			handleThumbnailsHeightChange={(height) => updateState({ thumbnailsHeight: height })}
			isRequestRunning={isRequestRunning}
			isInTask={isInTask}
			handleKeyDown={handleKeyDown}
			handlePaste={handlePaste}
		/>
	)
})
