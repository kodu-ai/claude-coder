import React, { KeyboardEvent, useRef, useState } from "react"
import Thumbnails from "../Thumbnails/Thumbnails"
import { Button } from "../ui/button"
import { vscode } from "@/utils/vscode"
import InputV1 from "./InputV1"

import GitDialog from "./GitDialog"
import TaskHistoryModal from "./TaskHistoryDialog"
import InteractiveTerminal from "../ChatRow/InteractiveTerminal"

interface InputAreaProps {
	inputValue: string
	setInputValue: (value: string) => void
	textAreaDisabled: boolean
	handleSendMessage: () => void
	handleKeyDown: (event: KeyboardEvent<HTMLDivElement> | KeyboardEvent<HTMLTextAreaElement>) => void
	handlePaste: (e: React.ClipboardEvent) => void
	placeholderText: string
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
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
	textAreaDisabled,
	handleSendMessage,
	handleKeyDown,
	handlePaste,
	placeholderText,
	selectedImages,
	setSelectedImages,
	shouldDisableImages,
	selectImages,
	thumbnailsHeight,
	handleThumbnailsHeightChange,
	isRequestRunning,
	isInTask,
}) => {
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const [isTextAreaFocused, setIsTextAreaFocused] = useState(false)

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
				{isInTask && (
					<div className="flex justify-between">
						<Button
							onClick={() => vscode.postMessage({ type: "cancelCurrentRequest" })}
							disabled={!isRequestRunning}
							size="sm"
							variant="destructive"
							className="w-fit">
							Abort Request
						</Button>

						{/* <div className="flex gap-2">
							<TaskHistoryModal />

							<GitDialog />
						</div> */}
					</div>
				)}

				{/* {!isTextAreaFocused && (
					<div
						style={{
							position: "absolute",
							inset: "8px 16px",
							border: "1px solid var(--vscode-input-border)",
							borderRadius: 2,
							pointerEvents: "none",
						}}
					/>
				)} */}

				{/* @TODO: only for testing, remove this */}
				<InteractiveTerminal />

				<InputV1
					isRequestRunning={isRequestRunning}
					thumbnailsHeight={thumbnailsHeight}
					ref={textAreaRef}
					value={inputValue}
					disabled={textAreaDisabled || isRequestRunning}
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
							position: "absolute",
							paddingTop: 4,
							bottom: 14,
							left: 22,
							right: 67,
						}}
					/>
				)}
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
