import { useCallback, useState } from "react"
import { AlertCircle, ChevronDown, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

export default function DeprecationBanner() {
	const [isExpanded, setIsExpanded] = useState(false)
	return (
		<Card className="rounded-none sticky top-0">
			<CardContent className="p-4 rounded-none">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-destructive" />
						<h2 className="text-sm font-semibold">Extension Deprecated</h2>
					</div>
				</div>

				<Collapsible open={isExpanded} className="mt-2" onOpenChange={setIsExpanded}>
					<div className="mt-2 text-sm text-card-foreground space-y-2">
						<p>This extension is now deprecated and will no longer receive updates.</p>
						<p>
							Please switch to{" "}
							<a
								href="https://marketplace.visualstudio.com/items?itemName=kodu-ai.claude-dev-experimental"
								className="text-primary hover:underline font-medium">
								Claude Coder
							</a>
							, the successor to this extension.
						</p>
					</div>

					<CollapsibleContent className="mt-2 text-sm text-card-foreground space-y-2">
						<p>Claude Coder offers:</p>
						<p>• Improved performance and stability</p>
						<p>• Enhanced features and capabilities</p>
						<p>• Regular updates and support</p>
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
								href="https://marketplace.visualstudio.com/items?itemName=kodu-ai.claude-dev-experimental"
								target="_blank"
								rel="noreferrer">
								Install Claude Coder
							</a>
						</Button>
					</div>
				</Collapsible>
			</CardContent>
		</Card>
	)
}
