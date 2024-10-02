import React, { useState, useRef, useEffect, KeyboardEvent, forwardRef, useImperativeHandle, useCallback } from "react"
import { vscode } from "@/utils/vscode"
import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { useEvent } from "react-use"
import InputTextArea from "./InputTextArea"
import MentionPopover, { popoverOptions } from "./MentionPopover"
import FileDialog from "./FileDialog"
import ScrapeDialog from "./ScrapeDialog"
import AttachedResources, { Resource } from "./AttachedResources"
import { FileNode } from "./file-tree"

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
	const [cursorPosition, setCursorPosition] = useState(0)
	const [focusedIndex, setFocusedIndex] = useState(-1)
	const localTextareaRef = useRef<HTMLTextAreaElement>(null)
	const [openDialog, setOpenDialog] = useState<string | null>(null)
	const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
	const [scrapeUrl, setScrapeUrl] = useState("")
	const [scrapeDescription, setScrapeDescription] = useState("")
	const [fileTree, setFileTree] = useState<FileNode[]>([])
	const [attachedResources, setAttachedResources] = useState<Resource[]>([])

	useImperativeHandle(forwardedRef, () => localTextareaRef.current!, [])

	useEffect(() => {
		vscode.postMessage({ type: "fileTree" })
	}, [])

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		if (message.type === "fileTree") {
			setFileTree(message.tree)
		}
	}, [])

	useEvent("message", handleMessage)

	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		props.onChange(e)
		const newValue = e.target.value
		const previousValue = textareaValue
		setTextareaValue(newValue)

		// check if this was a paste event skipping the "@" check
		if (newValue.length > previousValue.length + 1) {
			return
		}

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
		const newResources: Resource[] = Array.from(selectedItems).map((item) => ({
			id: item,
			type: item.includes(".") ? "file" : "folder",
			name: item.split("/").pop() || item,
		}))
		setAttachedResources((prev) => [...prev, ...newResources])
		handleCloseDialog()
		// remove @ from the text
		const newText = textareaValue.slice(0, cursorPosition - 1) + textareaValue.slice(cursorPosition)
		setTextareaValue(newText)
	}

	const handleScrapeSubmit = () => {
		if (scrapeUrl) {
			const newResource: Resource = {
				id: Date.now().toString(),
				type: "url",
				name: scrapeUrl,
			}
			setAttachedResources((prev) => [...prev, newResource])
			handleCloseDialog()
		}
	}

	const handleOpenDialog = (dialogName: string) => {
		setOpenDialog(dialogName)
		setShowPopover(false)
		setSelectedItems(new Set())
		if (openDialog === "fileFolder") {
			vscode.postMessage({ type: "fileTree" })
		}
	}

	const handleCloseDialog = () => {
		setOpenDialog(null)
		setSelectedItems(new Set())
		setScrapeUrl("")
		setScrapeDescription("")
		localTextareaRef.current?.focus()
	}

	const handleRemoveResource = (id: string) => {
		setAttachedResources((prev) => prev.filter((resource) => resource.id !== id))
	}

	return (
		<>
			<div className="relative w-full">
				<AttachedResources
					onRemoveAll={() => setAttachedResources([])}
					resources={attachedResources}
					onRemove={handleRemoveResource}
				/>
				<InputTextArea
					{...props}
					ref={localTextareaRef}
					value={props.value}
					onChange={handleTextareaChange}
					onKeyDown={handleKeyDown}
					setShowPopover={setShowPopover}
				/>
				<MentionPopover
					showPopover={showPopover}
					setShowPopover={setShowPopover}
					focusedIndex={focusedIndex}
					setFocusedIndex={setFocusedIndex}
					handleOpenDialog={handleOpenDialog}
					handleKeyDown={handleKeyDown}
				/>
			</div>

			<FileDialog
				open={openDialog === "fileFolder"}
				onClose={handleCloseDialog}
				fileTree={fileTree}
				selectedItems={selectedItems}
				setSelectedItems={setSelectedItems}
				onSubmit={handleSubmitSelection}
			/>

			<ScrapeDialog
				open={openDialog === "scrape"}
				onClose={handleCloseDialog}
				scrapeUrl={scrapeUrl}
				setScrapeUrl={setScrapeUrl}
				scrapeDescription={scrapeDescription}
				setScrapeDescription={setScrapeDescription}
				onSubmit={handleScrapeSubmit}
			/>
		</>
	)
})

InputV2.displayName = "InputV2"

export default InputV2
