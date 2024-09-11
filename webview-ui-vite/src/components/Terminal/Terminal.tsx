import React, { useState, useEffect, useRef } from "react"
import DynamicTextArea from "react-textarea-autosize"
import stripAnsi from "strip-ansi"
import { terminalContainerStyle, textAreaStyle } from "./styles"
import TerminalMirror from "./TerminalMirror"

interface TerminalProps {
	rawOutput: string
	handleSendStdin: (text: string) => void
	shouldAllowInput: boolean
}

const Terminal: React.FC<TerminalProps> = ({ rawOutput, handleSendStdin, shouldAllowInput }) => {
	const [userInput, setUserInput] = useState("")
	const [isFocused, setIsFocused] = useState(false)
	const [cursorPosition, setCursorPosition] = useState(0)
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null)

	const [lastProcessedOutput, setLastProcessedOutput] = useState("")

	const output = stripAnsi(rawOutput)

	useEffect(() => {
		if (lastProcessedOutput !== output) {
			setUserInput("")
		}
	}, [output, lastProcessedOutput])

	const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter") {
			e.preventDefault()
			handleSendStdin(userInput)
			setLastProcessedOutput(output)
			resizeTextArea()
		}
	}

	useEffect(() => {
		setUserInput("")
	}, [output])

	useEffect(() => {
		const textarea = textAreaRef.current
		const hiddenTextarea = hiddenTextareaRef.current
		if (!textarea || !hiddenTextarea) return

		const updateSize = () => {
			hiddenTextarea.value = textarea.value
			const newHeight = hiddenTextarea.scrollHeight
			textarea.style.height = `${newHeight}px`
		}

		updateSize()

		const resizeObserver = new ResizeObserver(updateSize)
		resizeObserver.observe(textarea)

		const handleWindowResize = () => {
			hiddenTextarea.style.width = `${textarea.clientWidth}px`
			updateSize()
		}
		window.addEventListener("resize", handleWindowResize)

		return () => {
			resizeObserver.disconnect()
			window.removeEventListener("resize", handleWindowResize)
		}
	}, [])

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value
		if (newValue.startsWith(output)) {
			setUserInput(newValue.slice(output.length))
		} else {
			e.target.value = output + userInput
		}
		resizeTextArea()
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const textarea = e.target as HTMLTextAreaElement
		const cursorPosition = textarea.selectionStart

		if (e.key === "Backspace" && cursorPosition <= output.length) {
			e.preventDefault()
		}

		setTimeout(() => {
			setCursorPosition(textarea.selectionStart)
		}, 0)
	}

	const resizeTextArea = () => {
		const textarea = textAreaRef.current
		const hiddenTextarea = hiddenTextareaRef.current
		if (textarea && hiddenTextarea) {
			hiddenTextarea.value = output + userInput
			const newHeight = hiddenTextarea.scrollHeight
			textarea.style.height = `${newHeight}px`
		}
	}

	return (
		<div className="terminal-container">
			<style>{terminalContainerStyle}</style>
			<DynamicTextArea
				ref={textAreaRef}
				value={output + (shouldAllowInput ? userInput : "")}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onKeyPress={handleKeyPress}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
				className="terminal-textarea"
				style={textAreaStyle}
				minRows={1}
			/>
			<TerminalMirror
				textareaValue={output + userInput}
				cursorPosition={cursorPosition}
				isFocused={isFocused}
				shouldAllowInput={shouldAllowInput}
			/>
			<DynamicTextArea
				ref={hiddenTextareaRef}
				className="terminal-textarea"
				aria-hidden="true"
				tabIndex={-1}
				readOnly
				minRows={1}
				style={{
					...textAreaStyle,
					position: "absolute",
					top: 0,
					left: 0,
					// @ts-expect-error - typing is wrong
					height: "100%",
					width: "100%",
					overflow: "hidden",
					opacity: 0,
					zIndex: -1,
				}}
			/>
		</div>
	)
}

export default Terminal
