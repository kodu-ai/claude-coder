import React, { useRef, useLayoutEffect, useMemo } from "react"
import { useWindowSize } from "react-use"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

// Image type detection utility
const detectImageType = (base64String: string): string => {
	// If it's already a data URL, return as is
	if (base64String.startsWith("data:image/")) {
		return base64String
	}

	// Magic numbers for different image formats
	const signatures: Record<string, string> = {
		"/9j/": "jpeg",
		iVBORw0KGgo: "png",
		R0lGOD: "gif",
		UklGRg: "webp",
		Qk0: "bmp",
	}

	let detectedType = "jpeg" // Default to JPEG
	for (const [signature, type] of Object.entries(signatures)) {
		if (base64String.startsWith(signature)) {
			detectedType = type
			break
		}
	}

	return `data:image/${detectedType};base64,${base64String}`
}

// ThumbnailItem Component
interface ThumbnailItemProps {
	image: string
	index: number
	isDeletable: boolean
	onDelete: (index: number) => void
}

export const ThumbnailItem: React.FC<ThumbnailItemProps> = ({ image, index, isDeletable, onDelete }) => {
	const [isOpen, setIsOpen] = React.useState(false)
	const formattedImage = useMemo(() => detectImageType(image), [image])

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation()
		onDelete(index)
	}

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="icon" className="relative w-[40px] h-[40px] p-0 overflow-hidden group">
					<img
						src={formattedImage}
						alt={`Thumbnail ${index + 1}`}
						className="w-full h-full object-cover rounded"
					/>
					{isDeletable && (
						<div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
				<img src={formattedImage} alt={`Full size ${index + 1}`} className="w-full h-full object-contain" />
			</DialogContent>
		</Dialog>
	)
}
