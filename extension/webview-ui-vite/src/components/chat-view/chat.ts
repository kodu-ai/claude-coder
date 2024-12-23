import { ClaudeAsk } from "../../../../src/shared/messages/extension-message"

export interface ChatViewProps {
	isHidden: boolean
	selectedModelSupportsImages: boolean
	selectedModelSupportsPromptCache: boolean
	showHistoryView: () => void
}

export interface ChatState {
	inputValue: string
	textAreaDisabled: boolean
	selectedImages: string[]
	thumbnailsHeight: number
	claudeAsk: ClaudeAsk | string | undefined
	enableButtons: boolean
	primaryButtonText?: string
	secondaryButtonText?: string
	expandedRows: Record<number, boolean>
	isAbortingRequest: boolean
}

export interface ButtonSectionProps {
	primaryButtonText?: string
	secondaryButtonText?: string
	enableButtons: boolean
	isRequestRunning: boolean
	handlePrimaryButtonClick: () => void
	handleSecondaryButtonClick: () => void
}
