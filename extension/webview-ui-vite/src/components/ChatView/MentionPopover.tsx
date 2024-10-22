import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useExtensionState } from '@/context/ExtensionStateContext'
import { vscode } from '@/utils/vscode'
import { Folder as FolderIcon, Link, ShieldAlert } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef } from 'react'

type MentionPopoverProps = {
	showPopover: boolean
	setShowPopover: (show: boolean) => void
	focusedIndex: number
	setFocusedIndex: (index: number) => void
	handleOpenDialog: (dialogName: string) => void
	handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
}
export const popoverOptions = [
	{ name: 'fileFolder', icon: FolderIcon, label: 'Select Files/Folders' },
	{ name: 'scrape', icon: Link, label: 'Paste URL to scrape' },
	{ name: 'debug', icon: ShieldAlert, label: 'Debug' },
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

	const handleOptionClick = (name: string) => {
		handleOpenDialog(name)
	}

	return (
		<Popover open={showPopover} onOpenChange={setShowPopover}>
			<PopoverTrigger asChild>
				<div />
			</PopoverTrigger>
			<PopoverContent
				className="w-56 p-0 bg-background border-border"
				align="start"
				side="top"
				onKeyDown={handleKeyDown}
			>
				<div className="grid gap-1" role="menu" aria-label="Options menu">
					{popoverOptions.map((option, index) => (
						<Button
							key={option.name}
							ref={(el) => (popoverButtonsRef.current[index] = el)}
							variant="ghost"
							className={`w-full justify-start text-left ${
								focusedIndex === index ? 'bg-secondary text-secondary-foreground' : ''
							}`}
							onClick={() => handleOptionClick(option.name)}
							onFocus={() => setFocusedIndex(index)}
							onMouseEnter={() => setFocusedIndex(index)}
							role="menuitem"
						>
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
