"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface ThumbnailItemProps {
	image: string
	index: number
	isDeletable: boolean
	onDelete: (index: number) => void
}

export default function ThumbnailItem({ image, index, isDeletable, onDelete }: ThumbnailItemProps) {
	const [isOpen, setIsOpen] = useState(false)

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation()
		onDelete(index)
	}

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="icon" className="relative w-[40px] h-[40px] p-0 overflow-hidden group">
					<img src={image} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover rounded" />
					{isDeletable && (
						<div className="absolute  bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
							<Button
								variant="destructive"
								size="icon"
								className="w-4 h-4 rounded-full"
								onClick={handleDelete}>
								<X className="size-3.5" />
								<span className="sr-only">Delete thumbnail</span>
							</Button>
						</div>
					)}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
				<img src={image} alt={`Full size ${index + 1}`} className="w-full h-full object-contain" />
			</DialogContent>
		</Dialog>
	)
}
