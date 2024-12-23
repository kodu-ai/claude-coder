import React, { useState, useEffect } from "react"
import { Eye, ChevronsUpDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface ApiMetrics {
	cost: number
	inputTokens: number
	outputTokens: number
	inputCacheRead: number
	inputCacheWrite: number
}

interface TaskBadgeProps {
	state?: "observing" | "complete"
	output?: string
	apiMetrics?: ApiMetrics
	modelId?: string
}

const LoadingDots = () => {
	const [dots, setDots] = useState("")
	useEffect(() => {
		const interval = setInterval(() => {
			setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
		}, 500)
		return () => clearInterval(interval)
	}, [])
	return <span className="w-6 inline-block">{dots}</span>
}

export const ObserverBadge: React.FC<TaskBadgeProps> = ({
	state = "observing",
	output = "Based on the observer's feedback, I realize I should have asked a follow-up question after reading the README.md",
	apiMetrics,
	modelId,
}) => {
	const [isHovered, setIsHovered] = useState(false)

	return (
		<div
			className="relative inline-block"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}>
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 border border-secondary cursor-pointer">
				<Eye className="w-3.5 h-3.5 text-primary" />
				<AnimatePresence mode="wait">
					<motion.span
						key={state}
						initial={{ opacity: 0, x: -5 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 5 }}
						className="text-xs font-mono text-secondary-foreground">
						{state === "observing" ? (
							<span className="flex items-center">
								Observing Task
								<LoadingDots />
							</span>
						) : (
							"Observation Complete"
						)}
					</motion.span>
				</AnimatePresence>
				<ChevronsUpDown className="w-3 h-3 text-muted-foreground" />
			</motion.div>

			<AnimatePresence>
				{isHovered && (
					<motion.div
						initial={{ opacity: 0, y: 5 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 5 }}
						className="absolute top-full mt-2 left-0 w-96 p-3 rounded-md z-10 border border-border shadow-lg bg-card">
						<div className="space-y-3 text-xs">
							<div className="space-y-1.5">
								<span className="text-muted-foreground font-mono">Model:</span>
								<p className="text-primary-foreground font-mono">{modelId}</p>
							</div>

							{apiMetrics && (
								<div className="space-y-2 border-t border-border pt-2">
									<div className="grid grid-cols-2 gap-2">
										<div>
											<span className="text-muted-foreground font-mono">Cost:</span>
											<p className="text-primary-foreground font-mono">
												${apiMetrics.cost.toFixed(4)}
											</p>
										</div>
										<div>
											<span className="text-muted-foreground font-mono">Tokens:</span>
											<p className="text-primary-foreground font-mono">
												{apiMetrics.inputTokens} → {apiMetrics.outputTokens}
											</p>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<span className="text-muted-foreground font-mono">Cache Read:</span>
											<p className="text-primary-foreground font-mono">
												{apiMetrics.inputCacheRead}
											</p>
										</div>
										<div>
											<span className="text-muted-foreground font-mono">Cache Write:</span>
											<p className="text-primary-foreground font-mono">
												{apiMetrics.inputCacheWrite}
											</p>
										</div>
									</div>
								</div>
							)}

							<div className="border-t border-border pt-2">
								<span className="text-muted-foreground font-mono">Output:</span>
								<p className="mt-1 text-primary-foreground text-xs">{output}</p>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
