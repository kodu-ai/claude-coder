import React, { KeyboardEvent, startTransition, useCallback, useEffect, useState } from "react"
import Thumbnails from "../thumbnails/thumbnails"
import { Button } from "../ui/button"
import InputV1 from "./input-v1"
import { AtSign, ImagePlus, SendHorizonal } from "lucide-react"
import { AbortButton } from "./abort-button"
import { vscode } from "@/utils/vscode"
import { ModelDisplay } from "./model-display"

interface InputAreaProps {
	inputRef: React.RefObject<HTMLTextAreaElement>
	inputValue: string
	setInputValue: (value: string) => void
	textAreaDisabled: boolean
	handleSendMessage: () => void
	handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
	handlePaste: (e: React.ClipboardEvent) => void
	placeholderText: string
	selectedImages: string[]
	setSelectedImages: (images: string[]) => void
	shouldDisableImages: boolean
	selectImages: () => void
	thumbnailsHeight: number
	handleThumbnailsHeightChange: (height: number) => void
	isRequestRunning: boolean
	isInTask: boolean
}

const useHandleAbort = (isRequestRunning: boolean) => {
	const [isAborting, setIsAborting] = useState(false)
	const handleAbort = useCallback(() => {
		if (isAborting) return
		setIsAborting(true)

		vscode.postMessage({ type: "cancelCurrentRequest" })
	}, [isAborting])

	useEffect(() => {
		if (!isRequestRunning) {
			setIsAborting(false)
		}
	}, [isRequestRunning])

	return [handleAbort, isAborting] as const
}

const InputArea: React.FC<InputAreaProps> = ({
	inputValue,
	setInputValue,
	inputRef,
	textAreaDisabled,
	handleSendMessage,
	handleKeyDown,
	handlePaste,
	selectedImages,
	setSelectedImages,
	shouldDisableImages,
	selectImages,
	thumbnailsHeight,
	handleThumbnailsHeightChange,
	isRequestRunning,
}) => {
	const [_, setIsTextAreaFocused] = useState(false)
	const [handleAbort, isAborting] = useHandleAbort(isRequestRunning)
	return (
		<>
			<div className="flex flex-col" style={{ padding: "8px 16px", position: "relative" }}>
				<div className="relative">
					<InputV1
						isRequestRunning={isRequestRunning}
						thumbnailsHeight={thumbnailsHeight}
						ref={inputRef}
						value={inputValue}
						disabled={textAreaDisabled}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						onFocus={() => setIsTextAreaFocused(true)}
						onBlur={() => setIsTextAreaFocused(false)}
						onPaste={handlePaste}
					/>
					<Thumbnails
						images={selectedImages}
						setImages={setSelectedImages}
						onHeightChange={handleThumbnailsHeightChange}
						style={{
							position: "absolute",
							paddingTop: 4,
							bottom: 8,
							left: 8,
							// right: 67,
						}}
					/>
					<div
						style={{
							position: "absolute",
							right: 4,
							top: "50%",
							transform: "translateY(-50%)",
						}}
						className="flex items-center gap-2">
						{isRequestRunning ? (
							<AbortButton isAborting={isAborting} onAbort={handleAbort} />
						) : (
							<Button
								tabIndex={0}
								disabled={textAreaDisabled}
								variant="ghost"
								className="!p-1 h-6 w-6"
								size="icon"
								aria-label="Send Message"
								onClick={handleSendMessage}>
								<SendHorizonal size={16} />
							</Button>
						)}
					</div>
				</div>

				<div className="flex justify-between items-center px-1 pt-1">
					<ModelDisplay />
					<div className="flex items-center gap-2">
						<Button
							tabIndex={0}
							variant="ghost"
							className="!p-1 h-6 w-6"
							size="icon"
							aria-label="Insert @"
							onClick={() => {
								if (inputRef.current) {
									if (inputRef.current) {
										const newText = inputRef.current.value + "@"
										inputRef.current.value = newText
										// Trigger React's change detection
										inputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
										inputRef.current.dispatchEvent(new Event("change", { bubbles: true }))
									}
									// Set cursor to end after DOM update
									setTimeout(() => {
										if (inputRef.current) {
											inputRef.current.focus()
											const newCursorPos = inputRef.current.value.length
											inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
										}
									}, 10)
								}
							}}>
							<AtSign size={16} />
						</Button>
						<Button
							tabIndex={0}
							disabled={shouldDisableImages}
							variant="ghost"
							className="!p-1 h-6 w-6"
							size="icon"
							aria-label="Attach Images"
							onClick={selectImages}>
							<ImagePlus size={16} />
						</Button>
					</div>
				</div>
			</div>
		</>
	)
}

export default InputArea
