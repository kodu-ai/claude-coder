import React from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card"
import { cn } from "../../lib/utils"

interface DiagnosticRowProps {
	state: "loading" | "loaded"
	diagnostics?: {
		key: string
		errorString: string | null
	}[]
}

export const DiagnosticRow: React.FC<DiagnosticRowProps> = ({ state, diagnostics }) => {
	const hasErrors = diagnostics?.some((d) => d.errorString)

	return (
		<div className="flex items-center space-x-2">
			<HoverCard>
				<HoverCardTrigger asChild>
					<div
						className={cn(
							"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
							"border border-border/40 hover:border-border/80",
							"transition-all duration-300 ease-in-out transform hover:scale-[1.02]",
							state === "loading"
								? "bg-muted/50 text-muted-foreground"
								: hasErrors
								? "bg-destructive/10 text-destructive hover:bg-destructive/20"
								: "bg-success/10 text-success hover:bg-success/20"
						)}>
						<div className="flex items-center space-x-2">
							<div
								className={cn(
									"w-1.5 h-1.5 rounded-full",
									state === "loading" && "animate-pulse bg-muted-foreground/30",
									state === "loaded" && (hasErrors ? "bg-destructive" : "bg-success")
								)}
							/>
							<span className="relative flex items-center space-x-1">
								<span>
									{state === "loading" ? "Loading Diagnostics" : "Diagnostics Loaded"}
									{state === "loading" && <span className="absolute inset-0 animate-pulse" />}
								</span>
								{state === "loaded" && diagnostics && (
									<span className="opacity-60 text-[10px]">({diagnostics.length})</span>
								)}
							</span>
						</div>
					</div>
				</HoverCardTrigger>
				<HoverCardContent
					className="w-[400px] p-3"
					align="start"
					side="bottom"
					sideOffset={4}
					avoidCollisions={true}>
					{state === "loaded" && diagnostics && (
						<div className="space-y-3">
							<h4 className="font-medium text-sm flex items-center space-x-2">
								<span>Diagnostic Results</span>
								<span className="text-xs opacity-60">({diagnostics.length})</span>
							</h4>
							<div className="space-y-3">
								{diagnostics.map((diagnostic) => (
									<div key={diagnostic.key} className="text-sm space-y-1">
										<div className="font-medium text-xs opacity-70">{diagnostic.key}</div>
										{diagnostic.errorString ? (
											<pre className="text-xs whitespace-pre text-destructive bg-destructive/5 p-2 rounded-md max-h-[240px] overflow-auto">
												{diagnostic.errorString}
											</pre>
										) : (
											<div className="text-xs text-success">No issues found</div>
										)}
									</div>
								))}
							</div>
						</div>
					)}
					{state === "loading" && (
						<div className="text-sm text-muted-foreground animate-pulse">
							Analyzing files for diagnostics...
						</div>
					)}
				</HoverCardContent>
			</HoverCard>
		</div>
	)
}

export default DiagnosticRow
