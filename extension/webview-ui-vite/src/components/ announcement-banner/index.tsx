import { useCallback, useState } from "react"
import { AlertCircle, ChevronDown, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

const isNewMajorOrMinorVersion = (currentVersion: string, lastVersion: string) => {
	const [currentMajor, currentMinor] = currentVersion.split(".").map(Number)
	const [lastMajor, lastMinor] = lastVersion.split(".").map(Number)

	return currentMajor > lastMajor || currentMinor > lastMinor
}

export default function AnnouncementBanner() {
	const { lastShownAnnouncementId, version } = useExtensionState()
	const isNewVersion = isNewMajorOrMinorVersion(version, lastShownAnnouncementId ?? "0.0.0")
	const [isExpanded, setIsExpanded] = useState(false)
	const [isDismissed, setIsDismissed] = useState(false)

	const closeAnnouncement = useCallback(() => {
		vscode.postMessage({
			type: "didCloseAnnouncement",
		})
		setIsDismissed(true)
	}, [])

	if (!isNewVersion || isDismissed) return null

	return (
		<Card className="rounded-none sticky top-0">
			<CardContent className="p-4 rounded-none">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-primary" />
						<h2 className="text-sm font-semibold">Latest Updates (v1.11.0)</h2>
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
						<p>• New Diff View Algorithm with improved CPU performance</p>
						<p>• Experimental Continuous Generation feature</p>
						<p>• Fixed diff view crash issues</p>
						<p>• Support for processing large files beyond context limits</p>
					</div>

					<CollapsibleContent className="mt-2 text-sm text-card-foreground space-y-2">
						<p>• Enhanced stability in diff view processing</p>
						<p>• Automatic request chaining for large files</p>
						<p>• Optimized CPU resource usage</p>
						<p>• Improved handling of context window limitations</p>
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
