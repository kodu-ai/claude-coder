import { useCallback, useState } from "react"
import { AlertCircle, ChevronDown, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

export default function AnnouncementBanner() {
	const { lastShownAnnouncementId, version } = useExtensionState()
	const [isExpanded, setIsExpanded] = useState(false)
	const [isDismissed, setIsDismissed] = useState(false)

	const closeAnnouncement = useCallback(() => {
		vscode.postMessage({
			type: "didCloseAnnouncement",
		})
		setIsDismissed(true)
	}, [])

	if (lastShownAnnouncementId === version || isDismissed) return null

	return (
		<Card className="rounded-none stikcy top-0">
			<CardContent className="p-4 rounded-none">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-primary" />
						<h2 className="text-sm font-semibold">Latest Updates (v1.10.0)</h2>
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 text-muted-foreground hover:text-foreground"
						onClick={() => closeAnnouncement()}>
						<X className="h-4 w-4" />
						<span className="sr-only">Dismiss</span>
					</Button>
				</div>

				<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
					<div className="mt-2 text-sm text-card-foreground space-y-2">
						<p>• Enhanced streaming UI implementation</p>
						<p>• New chat compression algorithm for improved memory usage</p>
						<p>• Fixed edge case stream corruption issues</p>
						<p>• Improved chat truncation prevention</p>
					</div>

					<CollapsibleContent className="mt-2 text-sm text-card-foreground space-y-2">
						<p>• Fixed image format handling</p>
						<p>• Reduced overall memory footprint</p>
						<p>• Enhanced response times</p>
						<p>• Optimized resource utilization</p>
					</CollapsibleContent>

					<div className="mt-3 flex items-center gap-4">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="sm">
								{isExpanded ? (
									<ChevronDown className="h-4 w-4 mr-1" />
								) : (
									<ChevronRight className="h-4 w-4 mr-1" />
								)}
								{isExpanded ? "Show less" : "Show more"}
							</Button>
						</CollapsibleTrigger>

						<Button asChild variant="ghost" size="sm">
							<a
								href="https://marketplace.visualstudio.com/items/kodu-ai.claude-dev-experimental/changelog"
								target="_blank"
								rel="noreferrer">
								View full changelog
							</a>
						</Button>
					</div>
				</Collapsible>
			</CardContent>
		</Card>
	)
}
