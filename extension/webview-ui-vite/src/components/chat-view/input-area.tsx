import React, { KeyboardEvent, useState } from "react"
import Thumbnails from "../thumbnails/thumbnails"
import { Button } from "../ui/button"
import InputV1 from "./input-v1"

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

	return (
		<>
			<div
				className="flex flex-col gap-2"
				style={{
					padding: "8px 16px",
					opacity: textAreaDisabled ? 0.5 : 1,
					position: "relative",
					display: "flex",
					marginTop: 0,
				}}>
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
						bottom: 14,
						left: 22,
						right: 67,
					}}
				/>
				<div
					style={{
						position: "absolute",
						right: 20,
						display: "flex",
						alignItems: "flex-center",
						height: "calc(100% - 80px)",
						marginTop: 30,
						marginBottom: 30,
						bottom: 10,
					}}>
					<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 2 }}>
						<Button
							tabIndex={0}
							disabled={shouldDisableImages}
							variant="ghost"
							className="!p-1 h-6 w-6"
							size="icon"
							aria-label="Attach Images"
							onClick={selectImages}
							style={{ marginRight: "2px" }}>
							<span className="codicon codicon-device-camera" style={{ fontSize: 16 }}></span>
						</Button>
						<Button
							tabIndex={0}
							disabled={textAreaDisabled}
							variant="ghost"
							className="!p-1 h-6 w-6"
							size="icon"
							aria-label="Send Message"
							onClick={handleSendMessage}>
							<span className="codicon codicon-send" style={{ fontSize: 16 }}></span>
						</Button>
					</div>
				</div>
			</div>
		</>
	)
}

export default InputArea
