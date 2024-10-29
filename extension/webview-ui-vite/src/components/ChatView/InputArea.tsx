import React, { KeyboardEvent, useState } from 'react'
import Thumbnails from '../Thumbnails/Thumbnails'
import { Button } from '../ui/button'
import InputV1 from './InputV1'

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
		<div className="fixed bottom-0 left-0 right-0 bg-background border-t">
			<div
				className="flex flex-col gap-2 relative p-4"
				style={{
					opacity: textAreaDisabled ? 0.5 : 1,
				}}
			>
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
				{selectedImages.length > 0 && (
					<Thumbnails
						images={selectedImages}
						setImages={setSelectedImages}
						onHeightChange={handleThumbnailsHeightChange}
						style={{
							position: 'absolute',
							bottom: '16px',
							left: '22px',
							right: '67px',
						}}
					/>
				)}
				<div
					className="absolute right-5 flex items-center h-full"
					style={{
						top: '50%',
						transform: 'translateY(-50%)',
					}}
				>
					<div className="flex items-center gap-2">
						<Button
							tabIndex={0}
							disabled={shouldDisableImages}
							variant="ghost"
							className="!p-1 h-6 w-6"
							size="icon"
							aria-label="Attach Images"
							onClick={selectImages}
						>
							<span className="codicon codicon-device-camera" style={{ fontSize: 16 }}></span>
						</Button>
						<Button
							tabIndex={0}
							disabled={textAreaDisabled}
							variant="ghost"
							className="!p-1 h-6 w-6"
							size="icon"
							aria-label="Send Message"
							onClick={handleSendMessage}
						>
							<span className="codicon codicon-send" style={{ fontSize: 16 }}></span>
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default InputArea
