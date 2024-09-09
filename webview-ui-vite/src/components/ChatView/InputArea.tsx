import React, { KeyboardEvent, useRef, useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import DynamicTextArea from "react-textarea-autosize"
import Thumbnails from "../Thumbnails/Thumbnails"
import { Button } from "../ui/button"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"

interface InputAreaProps {
	inputValue: string
	setInputValue: (value: string) => void
	textAreaDisabled: boolean
	handleSendMessage: () => void
	handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
	handlePaste: (e: React.ClipboardEvent) => void
	placeholderText: string
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
	shouldDisableImages: boolean
	selectImages: () => void
	thumbnailsHeight: number
	handleThumbnailsHeightChange: (height: number) => void
	isRequestRunning: boolean
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
}) => {
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const [isTextAreaFocused, setIsTextAreaFocused] = useState(false)
	return (
		<>
			{/* <div
				className={cn(
					`fixed bottom-[72px] left-[12px] transition-all duration-300`,
					// animate fade in out
					isRequestRunning ? "opacity-100" : "opacity-0",
					// if not running make it unclickable
					isRequestRunning ? "pointer-events-auto" : "pointer-events-none"
				)}>
				<VSCodeButton
					onClick={() => {
						vscode.postMessage({ type: "cancelCurrentRequest" })
					}}>
					Abort Request
				</VSCodeButton>
			</div> */}

			<div
				style={{
					padding: "8px 16px",
					opacity: textAreaDisabled ? 0.5 : 1,
					position: "relative",
					display: "flex",
				}}>
				{!isTextAreaFocused && (
					<div
						style={{
							position: "absolute",
							inset: "8px 16px",
							border: "1px solid var(--vscode-input-border)",
							borderRadius: 2,
							pointerEvents: "none",
						}}
					/>
				)}
				<DynamicTextArea
					ref={textAreaRef}
					value={inputValue}
					disabled={textAreaDisabled}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => setIsTextAreaFocused(true)}
					onBlur={() => setIsTextAreaFocused(false)}
					onPaste={handlePaste}
					placeholder={placeholderText}
					maxRows={10}
					autoFocus={true}
					style={{
						width: "100%",
						boxSizing: "border-box",
						backgroundColor: "var(--vscode-input-background)",
						color: "var(--vscode-input-foreground)",
						borderRadius: 2,
						fontFamily: "var(--vscode-font-family)",
						fontSize: "var(--vscode-editor-font-size)",
						lineHeight: "var(--vscode-editor-line-height)",
						resize: "none",
						overflow: "hidden",
						borderTop: "9px solid transparent",
						borderBottom: `${thumbnailsHeight + 9}px solid transparent`,
						borderRight: "54px solid transparent",
						borderLeft: "9px solid transparent",
						padding: 0,
						cursor: textAreaDisabled ? "not-allowed" : undefined,
						flex: 1,
					}}
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
						height: "calc(100% - 20px)",
						bottom: 10,
					}}>
					<div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
						<VSCodeButton
							disabled={shouldDisableImages}
							appearance="icon"
							aria-label="Attach Images"
							onClick={selectImages}
							style={{ marginRight: "2px" }}>
							<span
								className="codicon codicon-device-camera"
								style={{ fontSize: 18, marginLeft: -2, marginBottom: 1 }}></span>
						</VSCodeButton>
						<VSCodeButton
							disabled={textAreaDisabled}
							appearance="icon"
							aria-label="Send Message"
							onClick={handleSendMessage}>
							<span className="codicon codicon-send" style={{ fontSize: 16, marginBottom: -1 }}></span>
						</VSCodeButton>
					</div>
				</div>
			</div>
		</>
	)
}

export default InputArea
