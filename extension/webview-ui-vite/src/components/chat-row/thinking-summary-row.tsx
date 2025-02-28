import React from "react"
import { BrainCircuit, Lightbulb, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import MarkdownRenderer from "./markdown-renderer"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { Button } from "../ui/button"
import { useCollapseState } from "@/hooks/use-collapse-state"

interface ThinkingSummaryProps {
	content: string
	messageTs?: number
	forceCollapsed?: boolean
}

export const ThinkingSummaryRow: React.FC<ThinkingSummaryProps> = ({ content, messageTs, forceCollapsed }) => {
	const { isCollapsed, toggleCollapse } = useCollapseState()
	// If no messageTs provided, don't collapse
	// If forceCollapsed is true, we force it to be collapsed
	const isOpen = forceCollapsed ? false : messageTs ? !isCollapsed(messageTs) : true

	return (
		<div className="mb-1">
			<Collapsible defaultOpen={true} open={isOpen} onOpenChange={() => messageTs && toggleCollapse(messageTs)}>
				<div className="flex items-center gap-2 mb-3">
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="gap-1">
							<BrainCircuit className="size-4 text-primary" />
							<span className="text-xs font-medium mr-2">Thinking Summary</span>
							<ChevronDown
								className="size-4 transition-transform duration-200"
								style={{
									transform: isOpen ? "rotate(-90deg)" : "rotate(0deg)",
								}}
							/>
						</Button>
					</CollapsibleTrigger>
				</div>

				<CollapsibleContent>
					<div className="bg-primary/5 border-l-2 border-primary rounded-sm p-2">
						<div className="flex text-wrap flex-wrap gap-2">
							<MarkdownRenderer markdown={content} />
						</div>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	)
}

interface ExecutionPlanProps {
	content: string
	messageTs?: number
	forceCollapsed?: boolean
}

export const ExecutionPlanRow: React.FC<ExecutionPlanProps> = ({ content, messageTs, forceCollapsed }) => {
	const { isCollapsed, toggleCollapse } = useCollapseState()
	// If no messageTs provided, don't collapse
	// If forceCollapsed is true, we force it to be collapsed
	const isOpen = forceCollapsed ? false : messageTs ? !isCollapsed(messageTs) : true

	return (
		<div className="mb-1">
			<Collapsible defaultOpen={true} open={isOpen} onOpenChange={() => messageTs && toggleCollapse(messageTs)}>
				<div className="flex items-center gap-2 mb-3">
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="gap-1">
							<Lightbulb className="size-4 text-warning" />
							<span className="text-xs font-medium mr-2">Execution Plan</span>
							<ChevronDown
								className="size-4 transition-transform duration-200"
								style={{
									transform: isOpen ? "rotate(-90deg)" : "rotate(0deg)",
								}}
							/>
						</Button>
					</CollapsibleTrigger>
				</div>

				<CollapsibleContent>
					<div className="bg-warning/5 border-l-2 border-warning rounded-sm p-2">
						<div className="flex text-wrap flex-wrap gap-2">
							<MarkdownRenderer markdown={content} />
						</div>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	)
}
