import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, File, Folder, Link, ChevronRight, Trash2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export type Resource = {
	id: string
	type: "file" | "folder" | "url"
	name: string
}

type AttachedResourcesProps = {
	resources: Resource[]
	onRemove: (id: string) => void
	onRemoveAll: () => void
}

const AttachedResources: React.FC<AttachedResourcesProps> = ({ resources, onRemove, onRemoveAll }) => {
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)

	if (resources.length === 0) return null

	const getIcon = (type: Resource["type"]) => {
		switch (type) {
			case "file":
				return <File className="w-4 h-4 mr-2" />
			case "folder":
				return <Folder className="w-4 h-4 mr-2" />
			case "url":
				return <Link className="w-4 h-4 mr-2" />
		}
	}

	const ResourceItem = ({ resource, showFullName = false }: { resource: Resource; showFullName?: boolean }) => (
		<Tooltip>
			<TooltipTrigger>
				<div className="flex items-center bg-secondary text-secondary-foreground rounded-md px-2 py-1">
					{getIcon(resource.type)}
					<span className="text-sm mr-2">
						{showFullName
							? resource.name
							: resource.name.length > 5
							? resource.name.substring(0, 5) + "..."
							: resource.name}
					</span>
					<Button variant="ghost" size="sm" className="p-0 h-auto" onClick={() => onRemove(resource.id)}>
						<X className="w-4 h-4" />
					</Button>
				</div>
			</TooltipTrigger>
			<TooltipContent>{resource.name}</TooltipContent>
		</Tooltip>
	)

	const handleDeleteAll = () => {
		onRemoveAll()
		setShowDeleteConfirmation(false)
		setIsDialogOpen(false)
	}

	return (
		<>
			<div className="flex-1 flex flex-full mb-2">
				<div className="flex flex-wrap gap-2 items-center">
					{resources.slice(0, 2).map((resource) => (
						<ResourceItem key={resource.id} resource={resource} />
					))}
					{resources.length > 2 && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsDialogOpen(true)}
							className="flex items-center">
							<span className="mr-1">See All ({resources.length})</span>
							<ChevronRight className="w-4 h-4" />
						</Button>
					)}
				</div>
			</div>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>All Attached Resources</DialogTitle>
					</DialogHeader>
					<ScrollArea className="h-[300px] w-full pr-4">
						<div className="grid gap-4">
							{resources.map((resource) => (
								<ResourceItem key={resource.id} resource={resource} showFullName />
							))}
						</div>
					</ScrollArea>
					<DialogFooter>
						<Button
							variant="destructive"
							onClick={() => setShowDeleteConfirmation(true)}
							className="w-full sm:w-auto">
							<Trash2 className="w-4 h-4 mr-2" />
							Delete All
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Deletion</DialogTitle>
					</DialogHeader>
					<Alert variant="destructive">
						<AlertTitle>Warning</AlertTitle>
						<AlertDescription>
							Are you sure you want to delete all attached resources? This action cannot be undone.
						</AlertDescription>
					</Alert>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowDeleteConfirmation(false)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteAll}>
							Delete All
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default AttachedResources
