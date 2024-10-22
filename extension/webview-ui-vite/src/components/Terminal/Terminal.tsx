import type React from 'react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import DynamicTextArea from 'react-textarea-autosize'
import stripAnsi from 'strip-ansi'
import { ScrollArea } from '../ui/scroll-area'

interface TerminalProps {
	rawOutput: string
	handleSendStdin: (text: string) => void
	shouldAllowInput: boolean
}

/*
Inspired by https://phuoc.ng/collection/mirror-a-text-area/create-your-own-custom-cursor-in-a-text-area/

Note: Even though vscode exposes var(--vscode-terminalCursor-foreground) it does not render in front of a color that isn't var(--vscode-terminal-background), and it turns out a lot of themes don't even define some/any of these terminal color variables. Very odd behavior, so try changing themes/color variables if you don't see the caret.
*/

const Terminal = ({ rawOutput, handleSendStdin, shouldAllowInput }: TerminalProps) => {
	const [userInput, setUserInput] = useState('')
	const [isFocused, setIsFocused] = useState(false) // Initially not focused
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const mirrorRef = useRef<HTMLDivElement>(null)
	const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null)

	const [lastProcessedOutput, setLastProcessedOutput] = useState('')

	const output = useMemo(() => {
		return stripAnsi(rawOutput)
	}, [rawOutput])

	useEffect(() => {
		if (lastProcessedOutput !== output) {
			setUserInput('')
		}
	}, [output, lastProcessedOutput])

	const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			handleSendStdin(userInput)
			// setUserInput("") // Clear user input after processing
			setLastProcessedOutput(output)

			// Trigger resize after clearing input
			const textarea = textAreaRef.current
			const hiddenTextarea = hiddenTextareaRef.current
			if (textarea && hiddenTextarea) {
				hiddenTextarea.value = ''
				const newHeight = hiddenTextarea.scrollHeight
				textarea.style.height = `${newHeight}px`
			}
		}
	}

	useEffect(() => {
		setUserInput('') // Reset user input when output changes
	}, [output])

	useEffect(() => {
		const textarea = textAreaRef.current
		const mirror = mirrorRef.current
		const hiddenTextarea = hiddenTextareaRef.current
		if (!textarea || !mirror || !hiddenTextarea) {
			return
		}

		const textareaStyles = window.getComputedStyle(textarea)
		const stylesToCopy = [
			'border',
			'boxSizing',
			'fontFamily',
			'fontSize',
			'fontWeight',
			'letterSpacing',
			'lineHeight',
			'padding',
			'textDecoration',
			'textIndent',
			'textTransform',
			'whiteSpace',
			'wordSpacing',
			'wordWrap',
			'width',
			'height',
		]

		stylesToCopy.forEach((property) => {
			mirror.style[property as any] = textareaStyles[property as any]
			hiddenTextarea.style[property as any] = textareaStyles[property as any]
		})
		mirror.style.borderColor = 'transparent'
		hiddenTextarea.style.visibility = 'hidden'
		hiddenTextarea.style.position = 'absolute'
		// hiddenTextarea.style.height = "auto"
		hiddenTextarea.style.width = `${textarea.clientWidth}px`
		hiddenTextarea.style.whiteSpace = 'pre-wrap'
		hiddenTextarea.style.overflowWrap = 'break-word'

		// const borderWidth = parseInt(textareaStyles.borderWidth, 10) || 0
		const updateSize = () => {
			hiddenTextarea.value = textarea.value
			const newHeight = hiddenTextarea.scrollHeight
			textarea.style.height = `${newHeight}px`
			mirror.style.width = `${textarea.offsetWidth}px`
			mirror.style.height = `${newHeight}px`
			hiddenTextarea.style.width = `${textarea.offsetWidth}px`
			hiddenTextarea.style.height = `${newHeight}px`
		}

		updateSize()

		const resizeObserver = new ResizeObserver(updateSize)
		resizeObserver.observe(textarea)

		// Add window resize event listener
		const handleWindowResize = () => {
			hiddenTextarea.style.width = `${textarea.clientWidth}px`
			updateSize()
		}
		window.addEventListener('resize', handleWindowResize)

		return () => {
			resizeObserver.disconnect()
			window.removeEventListener('resize', handleWindowResize)
		}
	}, [])

	useEffect(() => {
		const textarea = textAreaRef.current
		const mirror = mirrorRef.current
		if (!textarea || !mirror) {
			return
		}

		const handleScroll = () => {
			if (mirror) {
				mirror.scrollTop = textarea.scrollTop
			}
		}

		textarea.addEventListener('scroll', handleScroll)
		return () => textarea.removeEventListener('scroll', handleScroll)
	}, [])

	useEffect(() => {
		const textarea = textAreaRef.current
		const mirror = mirrorRef.current
		if (!textarea || !mirror) {
			return
		}

		const updateMirror = () => {
			const cursorPos = textarea.selectionStart
			const textBeforeCursor = textarea.value.substring(0, cursorPos)
			const textAfterCursor = textarea.value.substring(cursorPos)

			mirror.innerHTML = ''
			mirror.appendChild(document.createTextNode(textBeforeCursor))

			const caretEle = document.createElement('span')
			caretEle.classList.add('terminal-cursor')
			if (isFocused) {
				caretEle.classList.add('terminal-cursor-focused')
			}
			if (!shouldAllowInput) {
				caretEle.classList.add('terminal-cursor-hidden')
			}
			caretEle.innerHTML = '&nbsp;'
			mirror.appendChild(caretEle)

			mirror.appendChild(document.createTextNode(textAfterCursor))
		}

		// Update mirror on initial render
		updateMirror()

		document.addEventListener('selectionchange', updateMirror)
		return () => document.removeEventListener('selectionchange', updateMirror)
	}, [userInput, isFocused, shouldAllowInput])

	useEffect(() => {
		// Position the dummy caret at the end of the text on initial render
		const mirror = mirrorRef.current
		if (mirror) {
			const text = output + userInput
			mirror.innerHTML = ''
			mirror.appendChild(document.createTextNode(text))

			const caretEle = document.createElement('span')
			caretEle.classList.add('terminal-cursor')
			if (isFocused) {
				caretEle.classList.add('terminal-cursor-focused')
			}
			if (!shouldAllowInput) {
				caretEle.classList.add('terminal-cursor-hidden')
			}
			caretEle.innerHTML = '&nbsp;'
			mirror.appendChild(caretEle)
		}
	}, [output, userInput, isFocused, shouldAllowInput])

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value

		// Ensure the user can only edit their input after the output
		if (newValue.startsWith(output)) {
			setUserInput(newValue.slice(output.length))
		} else {
			// If the user tries to edit the output part, reset the value to the correct state
			e.target.value = output + userInput
		}

		// Trigger resize after setting user input
		const textarea = textAreaRef.current
		const hiddenTextarea = hiddenTextareaRef.current
		if (textarea && hiddenTextarea) {
			hiddenTextarea.value = output + userInput
			const newHeight = hiddenTextarea.scrollHeight
			textarea.style.height = `${newHeight}px`
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const textarea = e.target as HTMLTextAreaElement
		const cursorPosition = textarea.selectionStart

		// Prevent backspace from deleting the output part
		if (e.key === 'Backspace' && cursorPosition <= output.length) {
			e.preventDefault()
		}

		// Update cursor position on backspace
		setTimeout(() => {
			const cursorPos = textarea.selectionStart
			const textBeforeCursor = textarea.value.substring(0, cursorPos)
			const textAfterCursor = textarea.value.substring(cursorPos)

			mirrorRef.current!.innerHTML = ''
			mirrorRef.current?.appendChild(document.createTextNode(textBeforeCursor))

			const caretEle = document.createElement('span')
			caretEle.classList.add('terminal-cursor')
			if (isFocused) {
				caretEle.classList.add('terminal-cursor-focused')
			}
			if (!shouldAllowInput) {
				caretEle.classList.add('terminal-cursor-hidden')
			}
			caretEle.innerHTML = '&nbsp;'
			mirrorRef.current?.appendChild(caretEle)

			mirrorRef.current?.appendChild(document.createTextNode(textAfterCursor))
		}, 0)
	}

	const textAreaStyle: React.CSSProperties = {
		fontFamily: 'var(--vscode-editor-font-family)',
		fontSize: 'var(--vscode-editor-font-size)',
		// padding: "10px",
		// border: "1px solid var(--vscode-editorGroup-border)",
		outline: 'none',
		whiteSpace: 'pre-wrap',
		overflow: 'hidden',
		width: '100%',
		boxSizing: 'border-box',
		resize: 'none',
	}

	return (
		<div className="terminal-container">
			<ScrollArea viewProps={{ className: 'max-h-[200px] w-full p-2 border-border border rounded' }}>
				<style>
					{`
					.terminal-container {
						position: relative;
						overflow: hidden;  // Add this
					}

					.terminal-textarea {
						background: transparent;
						caret-color: transparent;
						position: relative;
						z-index: 1;
					}

					.terminal-mirror {
						position: absolute;
						top: 0;
						left: 0;
						height: 100%;
						width: 100%;
						overflow: hidden;
						color: transparent;
						z-index: 0;
					}

					.terminal-cursor {
						border: 1px solid var(--vscode-terminal-foreground, #FFFFFF);
						position: absolute;
						width: 4px;
						margin-top: -0.5px;
					}

					.terminal-cursor-focused {
						background-color: var(--vscode-terminal-foreground, #FFFFFF);
						animation: blink 1s step-end infinite;
					}

					.terminal-cursor-hidden {
						display: none;
					}

					@keyframes blink {
						50% {
							opacity: 0;
						}
					}
				`}
				</style>
				<DynamicTextArea
					ref={textAreaRef}
					value={output + (shouldAllowInput ? userInput : '')}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					onKeyPress={handleKeyPress}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					className="terminal-textarea"
					style={{
						// backgroundColor: "var(--vscode-editor-background)", // NOTE: adding cursor ontop of this color wouldnt work on some themes
						caretColor: 'transparent', // Hide default caret
						color: 'var(--vscode-terminal-foreground)',
						borderRadius: '3px',
						...(textAreaStyle as any),
					}}
					minRows={1}
				/>
				<div ref={mirrorRef} className="terminal-mirror" />
				<DynamicTextArea
					ref={hiddenTextareaRef}
					className="terminal-textarea"
					aria-hidden="true"
					tabIndex={-1}
					readOnly
					minRows={1}
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						height: '100%',
						width: '100%',
						overflow: 'hidden',
						opacity: 0,
						...(textAreaStyle as any),
					}}
				/>
			</ScrollArea>
		</div>
	)
}

export default memo(Terminal)
