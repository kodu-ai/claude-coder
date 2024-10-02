import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import EnhancedFileTree, { FileNode } from "./file-tree"

type FileDialogProps = {
	open: boolean
	onClose: () => void
	fileTree: FileNode[]
	selectedItems: Set<string>
	setSelectedItems: (items: Set<string>) => void
	onSubmit: () => void
}

const FileDialog: React.FC<FileDialogProps> = ({
	open,
	onClose,
	fileTree,
	selectedItems,
	setSelectedItems,
	onSubmit,
}) => {
	return (
		<Dialog open={open} onOpenChange={onClose}>
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
						onItemSelect={(items) => setSelectedItems(items)}
						value={selectedItems}
					/>
				</div>
				<Button onClick={onSubmit}>Add Selected Items</Button>
			</DialogContent>
		</Dialog>
	)
}

export default FileDialog
