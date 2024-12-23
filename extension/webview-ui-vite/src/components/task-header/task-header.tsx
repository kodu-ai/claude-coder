import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { ClaudeMessage } from "../../../../src/shared/messages/extension-message"
import { vscode } from "../../utils/vscode"
import Thumbnails from "../thumbnails/thumbnails"
import { ApiProvider } from "../../../../src/shared/api"
import TaskText from "./task-text"
import TokenInfo from "./token-info"
import CreditsInfo from "./credits-info"
import { useExtensionState } from "@/context/extension-state-context"
import BugReportDialog from "./bug-report-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"

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
	apiProvider?: ApiProvider
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
}: TaskHeaderProps) {
	const { currentTaskId, currentTask, currentContextTokens, currentContextWindow } = useExtensionState()
	const [isOpen, setIsOpen] = React.useState(true)

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
					</div>
					<CreditsInfo koduCredits={koduCredits} vscodeUriScheme={vscodeUriScheme} />
				</CollapsibleContent>
			</Collapsible>
		</section>
	)
}
