import React from "react"
import { CheckCircle2, Clock } from "lucide-react"
import { formatDate } from "@/utils/dateFormatter"

interface TaskCardProps {
	id: string
	task: string
	ts: number
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	onSelect: (id: string) => void
	isCompleted?: boolean
}

const TaskCard: React.FC<TaskCardProps> = ({
	id,
	task,
	ts,
	tokensIn,
	tokensOut,
	cacheWrites,
	cacheReads,
	totalCost,
	onSelect,
	isCompleted,
}) => (
	<div
		className={`group relative m-0 mb-4 p-4 bg-card hover:bg-accent/50 border border-gray-700 rounded-md shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
			isCompleted ? "hover:border-success/50" : "hover:border-info/50"
		}`}
		onClick={() => onSelect(id)}>
		<div className="absolute top-4 right-4 opacity-70 group-hover:opacity-100 transition-opacity">
			{isCompleted ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4 text-info" />}
		</div>

		<div className="space-y-3 min-w-0">
			<div className={`pr-6 text-card-foreground line-clamp-3 break-words text-sm leading-relaxed`}>{task}</div>

			<div className="text-light flex-line wrap !gap-1" style={{ justifyContent: "space-between" }}>
				<div className="flex-line nowrap">
					Tokens:
					<code>
						<span>↑</span>
						{tokensIn?.toLocaleString() ?? 0}
					</code>
					<code>
						<span>↓</span>
						{tokensOut?.toLocaleString() ?? 0}
					</code>
				</div>
				{!!cacheWrites && !!cacheReads && (
					<div className="flex-line nowrap">
						Cache:
						<code>
							<span>+</span>
							{cacheWrites?.toLocaleString()}
						</code>
						<code>
							<span>→</span>
							{cacheReads?.toLocaleString()}
						</code>
					</div>
				)}
				<div className="flex-line nowrap">
					API Cost:
					<code>
						<span>$</span>
						{totalCost?.toFixed(4) ?? 0}
					</code>
				</div>
			</div>
		</div>
		<div className="text-light">{formatDate(ts)}</div>
	</div>
)

export default TaskCard
