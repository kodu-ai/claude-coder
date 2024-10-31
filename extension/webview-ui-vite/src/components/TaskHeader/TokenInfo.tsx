import { ArrowRightCircle, DatabaseBackup, FileInput, FileOutput, FilePen, Gauge, PlusCircle } from "lucide-react"
import React from "react"
import { Progress } from "../ui/progress"

interface TokenInfoProps {
	tokensIn: number
	tokensOut: number
	doesModelSupportPromptCache: boolean
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	currentContextTokens?: number
	currentContextWindow?: number
}

const TokenInfo: React.FC<TokenInfoProps> = ({
	tokensIn,
	tokensOut,
	doesModelSupportPromptCache,
	cacheWrites,
	cacheReads,
	totalCost,
	currentContextTokens,
	currentContextWindow,
}) => {
	const contextPercentage = currentContextWindow
		? Math.round((currentContextTokens ?? 0 / currentContextWindow) * 100)
		: 0

	return (
		<div className="flex flex-col gap-1 p-1 sm:gap-1.5 sm:p-1.5 rounded-lg bg-background/95">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3 sm:gap-y-1.5 text-[11px] sm:text-xs">
				<span className="flex items-center gap-1.5 min-w-0">
					<span className="text-muted-foreground whitespace-nowrap">In/Out:</span>
					<span className="flex items-center gap-1 min-w-0">
						<FileInput className="w-3 h-3 text-muted-foreground shrink-0" />
						<span className="truncate">{tokensIn.toLocaleString()}</span>
					</span>
					<span className="flex items-center gap-1 min-w-0">
						<FilePen className="w-3 h-3 text-muted-foreground shrink-0" />
						<span className="truncate">{tokensOut.toLocaleString()}</span>
					</span>
				</span>

				{(doesModelSupportPromptCache || cacheReads !== undefined || cacheWrites !== undefined) && (
					<span className="flex items-center gap-1.5 min-w-0">
						<span className="text-muted-foreground whitespace-nowrap">Cache:</span>
						<span className="flex items-center gap-1 min-w-0">
							<PlusCircle className="w-3 h-3 text-muted-foreground shrink-0" />
							<span className="truncate">{cacheWrites?.toLocaleString()}</span>
						</span>
						<span className="flex items-center gap-1 min-w-0">
							<DatabaseBackup className="w-3 h-3 text-muted-foreground shrink-0" />
							<span className="truncate">{cacheReads?.toLocaleString()}</span>
						</span>
					</span>
				)}

				<span className="flex items-center gap-1 min-w-0">
					<span className="text-muted-foreground whitespace-nowrap">Cost:</span>
					<span className="truncate">${totalCost.toFixed(4)}</span>
				</span>
			</div>

			{(currentContextWindow ?? 0) > 0 && (
				<div className="flex flex-col gap-0.5 sm:gap-1">
					<div className="flex items-center justify-between text-[11px] sm:text-xs">
						<span className="flex items-center gap-1 min-w-0">
							<Gauge className="w-3 h-3 text-muted-foreground shrink-0" />
							<span className="text-muted-foreground whitespace-nowrap">Memory:</span>
							<span className="truncate">
								{currentContextTokens ?? 0}/{currentContextWindow ?? 0}
							</span>
						</span>
						<span className="text-muted-foreground whitespace-nowrap">{contextPercentage}%</span>
					</div>
					<Progress value={contextPercentage} className="h-0.5" />
				</div>
			)}
		</div>
	)
}

export default TokenInfo
