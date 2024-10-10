import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Link } from 'lucide-react'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

export interface FileItem {
	name: string
	content: string
}

export interface UrlItem {
	url: string
	description: string
}

const getFileExtension = (filename: string): string => {
	const parts = filename.split('.')
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

const getLanguageIcon = (filename: string): string => {
	const extension = getFileExtension(filename)
	return extension.toUpperCase()
}

const isFileItem = (item: FileItem | UrlItem): item is FileItem => {
	return (item as FileItem).name !== undefined
}

const isUrlItem = (item: FileItem | UrlItem): item is UrlItem => {
	return (item as UrlItem).url !== undefined
}

export default function AttachmentsList({
	files,
	urls,
}: {
	files?: FileItem[]
	urls?: UrlItem[]
}) {
	const [isExpanded, setIsExpanded] = useState(false)
	const items = [...(files ?? []), ...(urls ?? [])]

	if (items.length === 0) {
		return null
	}

	// Determine how many items should be visible by default
	const visibleCount = isExpanded ? items.length : 3
	const visibleItems = items.slice(0, visibleCount)
	const hiddenCount = items.length - visibleCount

	const toggleExpand = () => {
		setIsExpanded(!isExpanded)
	}

	return (
		<div className="space-y-1 mt-1">
			<div className="flex flex-wrap gap-1 items-center">
				{visibleItems.map((item, index) =>
					isFileItem(item) ? (
						<Button
							key={index}
							variant="outline"
							className="bg-gray-700 text-white hover:bg-gray-600 transition-colors h-6 px-2 py-0 text-xs"
						>
							<span className="font-mono mr-1 border border-gray-500 rounded px-1">
								{getLanguageIcon(item.name)}
							</span>
							<span>{item.name}</span>
						</Button>
					) : (
						<Tooltip key={index}>
							<TooltipContent>{item.url}</TooltipContent>
							<TooltipTrigger>
								<Button
									key={index}
									variant="outline"
									className="bg-gray-700 text-white hover:bg-gray-600 transition-colors h-6 px-2 py-0 text-xs"
								>
									<Link className="w-3 h-3 mr-1" />
									<span>{item.description}</span>
								</Button>
							</TooltipTrigger>
						</Tooltip>
					),
				)}

				{items.length > 3 && (
					<Button
						variant="outline"
						onClick={toggleExpand}
						className="bg-gray-600 text-white hover:bg-gray-500 transition-colors h-6 px-2 py-0 text-xs"
					>
						{isExpanded ? (
							<>
								<ChevronUp className="w-3 h-3 mr-1" />
								<span>Less</span>
							</>
						) : (
							<>
								<ChevronDown className="w-3 h-3 mr-1" />
								<span>+{hiddenCount}</span>
							</>
						)}
					</Button>
				)}
			</div>
		</div>
	)
}