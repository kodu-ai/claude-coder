import React, { useEffect } from "react"
import { useAtom } from "jotai"
import { hasShownAbortTooltipAtom } from "@/lib/atoms"
import { Button } from "../ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip"
import { PauseCircle } from "lucide-react"

interface AbortButtonProps {
	isAborting: boolean
	onAbort: () => void
}

export const AbortButton: React.FC<AbortButtonProps> = ({ isAborting, onAbort }) => {
	const [hasShownTooltip, setHasShownTooltip] = useAtom(hasShownAbortTooltipAtom)

	useEffect(() => {
		if (!hasShownTooltip) {
			const timer = setTimeout(() => {
				setHasShownTooltip(true)
			}, 3000)
			return () => clearTimeout(timer)
		}
	}, [hasShownTooltip, setHasShownTooltip])

	return (
		<TooltipProvider>
			<Tooltip open={!hasShownTooltip} defaultOpen={!hasShownTooltip}>
				<TooltipTrigger asChild>
					<Button
						disabled={isAborting}
						tabIndex={0}
						variant="ghost"
						className="!p-1 h-6 w-6"
						size="icon"
						aria-label="Abort Request"
						onClick={onAbort}
						style={{ marginRight: "2px" }}>
						<PauseCircle size={16} />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Click here to abort request</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}
