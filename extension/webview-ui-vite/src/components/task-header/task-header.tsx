import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { ClaudeMessage } from "../../../../src/shared/messages/extension-message"
import { Button } from "../ui/button"
import { vscode } from "../../utils/vscode"
import { cn } from "@/lib/utils"
import Thumbnails from "../thumbnails/thumbnails"
import TaskText from "./task-text"
import TokenInfo from "./token-info"
import CreditsInfo from "./credits-info"
import { useExtensionState } from "@/context/extension-state-context"
import { useCollapseState } from "@/context/collapse-state-context"
import BugReportDialog from "./bug-report-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp, FoldVertical, Clock, CheckSquare, CheckCircleIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"
import { rpcClient } from "@/lib/rpc-client"

interface TaskHeaderProps {
	firstMsg?: ClaudeMessage
	tokensIn: number
	tokensOut: number
	doesModelSupportPromptCache: boolean
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	onClose: () => void
	isHidden: boolean
	koduCredits?: number
	vscodeUriScheme?: string
	elapsedTime?: number
}

function formatElapsedTime(ms: number): string {
	const seconds = Math.floor(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60

	if (minutes > 0) {
		return `${minutes}m ${remainingSeconds}s`
	}
	return `${seconds}s`
}

export default function TaskHeader({
	firstMsg: task,
	tokensIn,
	tokensOut,
	doesModelSupportPromptCache,
	cacheWrites,
	cacheReads,
	totalCost,
	onClose,
	koduCredits,
	vscodeUriScheme,
	elapsedTime,
}: TaskHeaderProps) {
	const { currentTaskId, currentTask, currentContextTokens, currentContextWindow } = useExtensionState()
	const { collapseAll, isAllCollapsed } = useCollapseState()
	const { mutate: markAsComplete, isPending } = rpcClient.markAsDone.useMutation()
	const [isOpen, setIsOpen] = React.useState(true)
	const [showTiming, setShowTiming] = React.useState(false)

	const handleDownload = () => {
		vscode.postMessage({ type: "exportCurrentTask" })
	}
	const handleRename = () => {
		vscode.postMessage({ type: "renameTask", isCurentTask: true })
	}

	return (
		<section className="pb-1">
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<div className="flex flex-wrap">
					<h3 className="uppercase">Task</h3>
					<div style={{ flex: "1 1 0%" }}></div>

					<BugReportDialog />
					<VSCodeButton appearance="icon" onClick={handleRename}>
						Rename
					</VSCodeButton>
					<VSCodeButton appearance="icon" onClick={handleDownload}>
						Export
					</VSCodeButton>
					{task && currentTaskId && (
						<>
							<Tooltip>
								<TooltipTrigger asChild>
									<VSCodeButton appearance="icon" onClick={() => setShowTiming(!showTiming)}>
										<Clock className={cn("h-4 w-4", showTiming && "text-accent-foreground")} />
									</VSCodeButton>
								</TooltipTrigger>
								<TooltipContent avoidCollisions side="left">
									{showTiming ? "Hide Task Timing" : "Show Task Timing"}
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<VSCodeButton
										appearance="icon"
										disabled={isPending}
										onClick={() => markAsComplete({ taskId: currentTaskId })}>
										<CheckCircleIcon className="h-4 w-4" />
									</VSCodeButton>
								</TooltipTrigger>
								<TooltipContent avoidCollisions side="left">
									Mark as Done
								</TooltipContent>
							</Tooltip>
						</>
					)}
					<Tooltip>
						<TooltipTrigger asChild>
							<VSCodeButton appearance="icon" onClick={collapseAll}>
								<FoldVertical
									size={16}
									className={cn("transition-transform", isAllCollapsed && "rotate-180")}
								/>
							</VSCodeButton>
						</TooltipTrigger>
						<TooltipContent avoidCollisions side="left">
							{isAllCollapsed ? "Expand All Messages" : "Collapse All Messages"}
						</TooltipContent>
					</Tooltip>
					<VSCodeButton appearance="icon" onClick={onClose}>
						<span className="codicon codicon-close"></span>
					</VSCodeButton>
					<Tooltip>
						<TooltipTrigger asChild>
							<CollapsibleTrigger asChild>
								<VSCodeButton appearance="icon">
									{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
								</VSCodeButton>
							</CollapsibleTrigger>
						</TooltipTrigger>
						<TooltipContent avoidCollisions side="left">
							{isOpen ? "Collapse" : "Expand"}
						</TooltipContent>
					</Tooltip>
					<div className="basis-full flex">
						<div key={currentTask?.name ?? currentTask?.task ?? task?.text} className="w-full">
							<TaskText text={currentTask?.name ?? currentTask?.task ?? task?.text} />
						</div>
					</div>
				</div>

				<CollapsibleContent className="flex flex-col pt-1 gap-2">
					<div
						className="flex flex-col pt-1 gap-2 w-full"
						key={currentTask?.name ?? currentTask?.task ?? task?.text}>
						{task?.images && task.images.length > 0 && <Thumbnails images={task.images} />}
						<TokenInfo
							tokensIn={currentTask?.tokensIn ?? tokensIn}
							tokensOut={currentTask?.tokensOut ?? tokensOut}
							doesModelSupportPromptCache={doesModelSupportPromptCache}
							cacheWrites={currentTask?.cacheWrites ?? cacheWrites}
							cacheReads={currentTask?.cacheReads ?? cacheReads}
							totalCost={currentTask?.totalCost ?? totalCost}
							currentContextTokens={currentContextTokens}
							currentContextWindow={currentContextWindow}
						/>
						{task && showTiming && (
							<div className="flex flex-col gap-1 text-xs text-muted-foreground mt-2">
								<AnimatePresence>
									<motion.div
										initial={{ height: 0, opacity: 0 }}
										animate={{ height: "auto", opacity: 1 }}
										exit={{ height: 0, opacity: 0 }}
										transition={{ duration: 0.2 }}
										className="overflow-hidden">
										<div className="border border-border/40 rounded-sm p-2">
											<div className="flex items-center justify-between">
												<span>Started:</span>
												<span>{new Date(task.ts).toLocaleTimeString()}</span>
											</div>
											{elapsedTime !== undefined && (
												<>
													<div className="flex items-center justify-between">
														<span>Completed:</span>
														<span>
															{new Date(task.ts + elapsedTime).toLocaleTimeString()}
														</span>
													</div>
													<div className="flex items-center justify-between border-t border-border/40 pt-1 mt-1 font-medium">
														<span>Total Time:</span>
														<span>{formatElapsedTime(elapsedTime)}</span>
													</div>
												</>
											)}
										</div>
									</motion.div>
								</AnimatePresence>
							</div>
						)}
					</div>
					<CreditsInfo koduCredits={koduCredits} vscodeUriScheme={vscodeUriScheme} />
				</CollapsibleContent>
			</Collapsible>
		</section>
	)
}
