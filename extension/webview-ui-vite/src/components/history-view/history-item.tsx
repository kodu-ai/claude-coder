import { Button } from "@/components/ui/button"
import { formatDate } from "@/utils/dateFormatter"
import { type HistoryItem } from "extension/shared/history-item"
import { CheckCircle2, Clock, Loader2, Trash2 } from "lucide-react"
import { useState } from "react"

type HistoryItemProps = {
	item: HistoryItem
	onSelect: (id: string) => void
	onDelete: (id: string) => void
	onExport: (id: string) => void
}

const HistoryItem = ({ item, onSelect, onDelete, onExport }: HistoryItemProps) => {
	const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({})
	return (
		<div
			className="cursor-pointer text-foreground border-b border-border hover:bg-secondary hover:text-secondary-foreground transition-colors"
			onClick={() => onSelect(item.id)}>
			<div className="flex flex-col gap-2 p-4 relative group">
				<div className="flex justify-between items-center">
					<div className="flex items-center gap-2">
						{
							// Show the status icon
							item.isCompleted ? (
								<CheckCircle2 className="w-4 h-4 text-success" />
							) : (
								<Clock className="w-4 h-4 text-info" />
							)
						}
						<span className="text-sm font-medium uppercase">{formatDate(item.ts)}</span>
					</div>
					<Button
						variant="ghost"
						size="sm"
						id={`delete-${item.id}`}
						disabled={isLoading[item.id]}
						className="opacity-80 group-hover:opacity-100 transition-opacity"
						onClick={(e) => {
							e.stopPropagation()
							setIsLoading((prev) => ({ ...prev, [item.id]: true }))
							onDelete(item.id)
						}}>
						<span className="sr-only">Delete</span>
						{isLoading[item.id] ? (
							<Loader2 className="animate-spin" size={16} />
						) : (
							<Trash2 aria-label="Delete" size={16} className="text-foreground" />
						)}
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
								className="opacity-80 group-hover:opacity-100 transition-opacity"
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
								className="opacity-80 group-hover:opacity-100 transition-opacity"
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
