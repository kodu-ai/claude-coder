import React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ThumbnailItemProps {
	image: string
	onDelete: () => void
}

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({ image, onDelete }) => {
	return (
		<div className="relative group">
			<img src={image} alt="Thumbnail" className="w-16 h-16 object-cover rounded-md" />
			<div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
				<Button
					variant="ghost"
					size="sm"
					className="p-1 h-auto text-white hover:text-red-500"
					onClick={onDelete}>
					<X className="w-4 h-4" />
				</Button>
			</div>
		</div>
	)
}

export default ThumbnailItem
