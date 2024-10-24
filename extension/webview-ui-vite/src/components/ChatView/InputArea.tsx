import React, { KeyboardEvent, useEffect, useRef, useState } from "react"
import Thumbnails from "../Thumbnails/Thumbnails"
import { Button } from "../ui/button"
import { vscode } from "@/utils/vscode"
import InputV1 from "./InputV1"

import GitDialog from "./GitDialog"
import TaskHistoryModal from "./TaskHistoryDialog"
import InteractiveTerminal from "../ChatRow/InteractiveTerminal"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import AnimatedAbortButton from "./animated-abort-button"

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
	const [isAborting, setIsAborting] = useState(false)
	useEffect(() => {
		if (!isRequestRunning) {
			setIsAborting(false)
		}
	}, [isRequestRunning])

	return (
		<>
			<AnimatedAbortButton
				isInTask={isInTask}
				isRequestRunning={isRequestRunning}
				isAborting={isAborting}
				onAbort={() => {
					setIsAborting(true)
					vscode.postMessage({ type: "cancelCurrentRequest" })
				}}
			/>
			<div
				className="flex flex-col gap-2"
				style={{
					padding: "8px 16px",
					opacity: textAreaDisabled ? 0.5 : 1,
					position: "relative",
					display: "flex",
					marginTop: 0,
				}}>
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

				{/* @TODO: only for testing*/}
				{/* <InteractiveTerminal /> */}

				<InputV1
					isRequestRunning={isRequestRunning}
					thumbnailsHeight={thumbnailsHeight}
					ref={textAreaRef}
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
