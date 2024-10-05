import React, { useEffect, useRef } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Link, Folder as FolderIcon, ShieldAlert } from "lucide-react"
import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"

type MentionPopoverProps = {
	showPopover: boolean
	setShowPopover: (show: boolean) => void
	focusedIndex: number
	setFocusedIndex: (index: number) => void
	handleOpenDialog: (dialogName: string) => void
	handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
}
export const popoverOptions = [
	{ name: "fileFolder", icon: FolderIcon, label: "Select Files/Folders" },
	{ name: "scrape", icon: Link, label: "Paste URL to scrape" },
]
const MentionPopover: React.FC<MentionPopoverProps> = ({
	showPopover,
	setShowPopover,
	focusedIndex,
	setFocusedIndex,
	handleOpenDialog,
	handleKeyDown,
}) => {
	const popoverButtonsRef = useRef<(HTMLButtonElement | null)[]>([])
	const { claudeMessages: messages } = useExtensionState()

	useEffect(() => {
		if (messages.length > 0 && popoverOptions.length < 3) {
			popoverOptions.push({ name: "debug", icon: ShieldAlert, label: "Debug Errors" })
		}
	}, [messages])

	const handleOptionClick = (name: string) => {
		if (["fileFolder", "scrape"].includes(name)) {
			handleOpenDialog(name)
		} else {
			vscode.postMessage({ type: "debug" })
			setShowPopover(false)
		}
	}

	return (
		<Popover open={showPopover} onOpenChange={setShowPopover}>
			<PopoverTrigger asChild>
				<div></div>
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
							onClick={() => handleOptionClick(option.name)}
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
	)
}

export default MentionPopover
