import React, { useState, useRef, useEffect, KeyboardEvent, forwardRef, useImperativeHandle, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Link, Folder as FolderIcon, ChevronDown, ChevronRight } from "lucide-react"
import DynamicTextArea from "react-textarea-autosize"
import { Checkbox } from "@/components/ui/checkbox"
import { vscode } from "@/utils/vscode"
import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { useEvent } from "react-use"
import { Input } from "../ui/input"
import EnhancedFileTree, { FileNode } from "./file-tree"

type InputOpts = {
	value: string
	disabled: boolean
	isRequestRunning: boolean
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
	onKeyDown: (e: KeyboardEvent<HTMLDivElement> | KeyboardEvent<HTMLTextAreaElement>) => void
	onFocus: () => void
	onBlur: () => void
	onPaste: (e: React.ClipboardEvent) => void
	thumbnailsHeight: number
}

const InputV2 = forwardRef<HTMLTextAreaElement, InputOpts>((props, forwardedRef) => {
	const [showPopover, setShowPopover] = useState(false)
	const [textareaValue, setTextareaValue] = useState(props.value ?? "")
	/**
	 * The position of the last triggered "@" character in the textarea.
	 */
	const [cursorPosition, setCursorPosition] = useState(0)
	const [focusedIndex, setFocusedIndex] = useState(-1)
	const localTextareaRef = useRef<HTMLTextAreaElement>(null)
	const [openDialog, setOpenDialog] = useState<string | null>(null)
	const popoverButtonsRef = useRef<(HTMLButtonElement | null)[]>([])
	const [isTextAreaFocused, setIsTextAreaFocused] = useState(false)
	const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
	const [scrapeUrl, setScrapeUrl] = useState("")
	const [scrapeDescription, setScrapeDescription] = useState("")
	const [fileTree, setFileTree] = useState<FileNode[]>([])
	const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
	const [filterText, setFilterText] = useState("")

	// Combine the forwarded ref with our local ref
	useImperativeHandle(forwardedRef, () => localTextareaRef.current!, [])

	const popoverOptions = [
		{ name: "fileFolder", icon: FolderIcon, label: "Select Files/Folders" },
		{ name: "scrape", icon: Link, label: "Paste URL to scrape" },
	]

	useEffect(() => {
		// Fetch available files and folders from VS Code extension
		vscode.postMessage({ type: "fileTree" })
	}, [])

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		switch (message.type) {
			case "fileTree":
				setFileTree(message.tree)

				break
		}
		// (react-use takes care of not registering the same listener multiple times even if this callback is updated.)
	}, [])

	useEvent("message", handleMessage)

	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		props.onChange(e)
		const newValue = e.target.value
		const previousValue = textareaValue
		setTextareaValue(newValue)

		const newAtPositions = getAllAtPositions(newValue)
		const prevAtPositions = getAllAtPositions(previousValue)

		if (newAtPositions.length > prevAtPositions.length) {
			// A new "@" was added
			const newAtPosition = newAtPositions.find((pos) => !prevAtPositions.includes(pos))
			if (newAtPosition !== undefined) {
				setShowPopover(true)
				setFocusedIndex(0)
				setCursorPosition(newAtPosition + 1)
			}
		} else if (newAtPositions.length < prevAtPositions.length) {
			// An "@" was removed
			if (newAtPositions.length === 0) {
				setShowPopover(false)
			} else {
				// Optional: focus on the last remaining "@"
				setCursorPosition(newAtPositions[newAtPositions.length - 1] + 1)
			}
		}
	}

	// Helper function to get all "@" positions
	const getAllAtPositions = (text: string): number[] => {
		const positions: number[] = []
		let position = text.indexOf("@")
		while (position !== -1) {
			positions.push(position)
			position = text.indexOf("@", position + 1)
		}
		return positions
	}

	const handleKeyDown = (e: KeyboardEvent<HTMLDivElement> | KeyboardEvent<HTMLTextAreaElement>) => {
		if (!showPopover) {
			props.onKeyDown(e)
		}
		if (showPopover) {
			switch (e.key) {
				case "ArrowDown":
				case "Tab":
					e.preventDefault()
					setFocusedIndex((prevIndex) => (prevIndex + 1) % popoverOptions.length)
					break
				case "ArrowUp":
					e.preventDefault()
					setFocusedIndex((prevIndex) => (prevIndex - 1 + popoverOptions.length) % popoverOptions.length)
					break
				case "Enter":
					if (focusedIndex !== -1) {
						e.preventDefault()
						handleOpenDialog(popoverOptions[focusedIndex].name)
					}
					break
				case "Escape":
					e.preventDefault()
					setShowPopover(false)
					break
			}
		}
	}

	const handleSubmitSelection = () => {
		if (selectedItems.size > 0) {
			// const lookupText = `please lookup files (${[...selectedItems].join(", ")})`
			const lookupText = `read files: ${
				// use xml
				[...selectedItems].map((item) => `<file>${item}</file>`).join("")
			}`
			// find the last "@" position using the cursorPosition state
			const lastAtPosition = textareaValue.lastIndexOf("@", cursorPosition - 1)
			const beforeAt = textareaValue.slice(0, lastAtPosition)
			const afterAt = textareaValue.slice(cursorPosition)
			setTextareaValue(`${beforeAt}${lookupText}${afterAt}`)
			console.log(`${beforeAt}${lookupText}${afterAt}`)
			handleCloseDialog()
		}
	}

	useEffect(() => {
		if (props.value !== textareaValue) {
			setTextareaValue(props.value)
		}
	}, [props.value])

	const handleScrapeSubmit = () => {
		if (scrapeUrl) {
			const scrapeText = `web search: <url${
				scrapeDescription ? ` description="${scrapeDescription}"` : ""
			}>${scrapeUrl}</url>`
			const lastAtPosition = textareaValue.lastIndexOf("@", cursorPosition - 1)
			const beforeAt = textareaValue.slice(0, lastAtPosition)
			const afterAt = textareaValue.slice(cursorPosition)
			setTextareaValue(`${beforeAt}${scrapeText}${afterAt}`)
			console.log(`${beforeAt}${scrapeText}${afterAt}`)
			handleCloseDialog()
		}
	}

	const handleOpenDialog = (dialogName: string) => {
		setOpenDialog(dialogName)
		setShowPopover(false)
		setSelectedItems(new Set())
	}

	const handleCloseDialog = () => {
		setOpenDialog(null)
		setSelectedItems(new Set())
		setScrapeUrl("")
		setScrapeDescription("")
		localTextareaRef.current?.focus()
	}

	return (
		<>
			<div className="relative w-full">
				<Popover open={showPopover} onOpenChange={setShowPopover}>
					<PopoverTrigger
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							localTextareaRef.current?.focus()
							setShowPopover(false)
						}}
						asChild>
						<div className="relative">
							<DynamicTextArea
								tabIndex={0}
								ref={localTextareaRef}
								value={textareaValue}
								disabled={props.disabled || props.isRequestRunning}
								onChange={handleTextareaChange}
								onKeyDown={handleKeyDown}
								onFocus={() => {
									setIsTextAreaFocused(true)
									props.onFocus()
								}}
								onBlur={() => {
									setIsTextAreaFocused(false)
									props.onBlur()
								}}
								onPaste={props.onPaste}
								placeholder={`Type your task or use @ to mention files or folders or URLs`}
								maxRows={10}
								className="!overflow-y-auto !min-h-[64px]"
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
									borderBottom: `${props.thumbnailsHeight + 9}px solid transparent`,
									borderRight: "54px solid transparent",
									borderLeft: "9px solid transparent",
									padding: 0,
									cursor: props.disabled ? "not-allowed" : undefined,
									flex: 1,
								}}
							/>
						</div>
					</PopoverTrigger>
					<PopoverContent
						className="w-56 p-0 bg-background border-border"
						align="start"
						side="top"
						onKeyDown={handleKeyDown}>
						<div className="grid gap-1" role="menu" aria-label="Options menu">
							{popoverOptions.map((option, index) => (
								<Button
									key={option.name}
									ref={(el) => (popoverButtonsRef.current[index] = el)}
									variant="ghost"
									className={`w-full justify-start text-left ${
										focusedIndex === index ? "bg-secondary text-secondary-foreground" : ""
									}`}
									onClick={() => handleOpenDialog(option.name)}
									onFocus={() => setFocusedIndex(index)}
									onMouseEnter={() => setFocusedIndex(index)}
									role="menuitem">
									<option.icon className="mr-2 h-4 w-4" />
									{option.label}
								</Button>
							))}
						</div>
					</PopoverContent>
				</Popover>
			</div>

			<Dialog open={openDialog === "fileFolder"} onOpenChange={handleCloseDialog}>
				<DialogContent className="max-w-[600px] w-[90vw] bg-background text-foreground">
					<DialogHeader>
						<DialogTitle>Select Files and Folders</DialogTitle>
						<DialogDescription>
							Choose the files and folders you want to reference in your message.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<EnhancedFileTree
							initialFiles={fileTree}
							onItemSelect={(item) => {
								console.log(item)
								setSelectedItems(item)
							}}
							value={selectedItems}
						/>
					</div>
					<Button onClick={handleSubmitSelection}>Add Selected Items</Button>
				</DialogContent>
			</Dialog>

			<Dialog open={openDialog === "scrape"} onOpenChange={handleCloseDialog}>
				<DialogContent className="max-w-[400px] w-[90vw] bg-background text-foreground">
					<DialogHeader>
						<DialogTitle>Web Scraping</DialogTitle>
						<DialogDescription>
							Enter a URL and description to create a web scraping task.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<Textarea
							placeholder="Enter URL here (e.g., https://example.com)"
							value={scrapeUrl}
							onChange={(e) => setScrapeUrl(e.target.value)}
							className="bg-secondary text-secondary-foreground"
						/>
						<Textarea
							placeholder="Enter description (e.g., product prices)"
							value={scrapeDescription}
							onChange={(e) => setScrapeDescription(e.target.value)}
							className="bg-secondary text-secondary-foreground"
						/>
						<DialogDescription>
							Example output: search https://example.com for product prices
						</DialogDescription>
						<Button onClick={handleScrapeSubmit}>Create Scraping Task</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
})

InputV2.displayName = "InputV2"

export default InputV2
