import { Button } from "@/components/ui/button"
import { formatDate } from "@/utils/dateFormatter"
import { type HistoryItem } from "../../../../src/shared/HistoryItem"

type HistoryItemProps = {
	item: HistoryItem
	onSelect: (id: string) => void
	onDelete: (id: string) => void
	onExport: (id: string) => void
}

const HistoryItem = ({ item, onSelect, onDelete, onExport }: HistoryItemProps) => {
	return (
		<div
			className="cursor-pointer text-foreground border-b border-border hover:bg-secondary hover:text-secondary-foreground transition-colors"
			onClick={() => onSelect(item.id)}>
			<div className="flex flex-col gap-2 p-4 relative">
				<div className="flex justify-between items-center">
					<span className="text-sm font-medium uppercase">{formatDate(item.ts)}</span>
					<Button
						variant="ghost"
						size="sm"
						className="delete-button opacity-0 group-hover:opacity-100 transition-opacity"
						onClick={(e) => {
							e.stopPropagation()
							onDelete(item.id)
						}}>
						<span className="sr-only">Delete</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="w-4 h-4">
							<path d="M3 6h18"></path>
							<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
							<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
						</svg>
					</Button>
				</div>
				<div
					className="text-sm line-clamp-3 whitespace-pre-wrap break-words overflow-wrap-anywhere"
					dangerouslySetInnerHTML={{ __html: item.name ?? item.task }}></div>

				<div className="flex flex-col gap-1 text-xs">
					<div className="flex justify-between items-center">
						<div className="flex items-center gap-2 flex-wrap">
							<span className="font-medium">Tokens:</span>
							<span className="flex items-center gap-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="w-3 h-3">
									<path d="m6 9 6 6 6-6"></path>
								</svg>
								{item.tokensIn?.toLocaleString()}
							</span>
							<span className="flex items-center gap-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="w-3 h-3">
									<path d="m18 15-6-6-6 6"></path>
								</svg>
								{item.tokensOut?.toLocaleString()}
							</span>
						</div>
						{!item.totalCost && (
							<Button
								variant="ghost"
								size="sm"
								className="export-button opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={(e) => {
									e.stopPropagation()
									onExport(item.id)
								}}>
								EXPORT
							</Button>
						)}
					</div>
					{!!item.cacheWrites && (
						<div className="flex items-center gap-2 flex-wrap">
							<span className="font-medium">Cache:</span>
							<span className="flex items-center gap-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="w-3 h-3">
									<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
									<path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
									<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
								</svg>
								+{item.cacheWrites?.toLocaleString()}
							</span>
							<span className="flex items-center gap-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="w-3 h-3">
									<path d="M5 12h14"></path>
									<path d="m12 5 7 7-7 7"></path>
								</svg>
								{item.cacheReads?.toLocaleString()}
							</span>
						</div>
					)}
					{!!item.totalCost && (
						<div className="flex justify-between items-center">
							<div className="flex items-center gap-2">
								<span className="font-medium">API Cost:</span>
								<span>${item.totalCost?.toFixed(4)}</span>
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="export-button opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={(e) => {
									e.stopPropagation()
									onExport(item.id)
								}}>
								EXPORT
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default HistoryItem
