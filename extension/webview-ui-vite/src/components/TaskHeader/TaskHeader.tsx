import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useExtensionState } from '@/context/ExtensionStateContext'
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import React from 'react'
import type { ClaudeMessage } from '../../../../src/shared/ExtensionMessage'
import type { ApiProvider } from '../../../../src/shared/api'
import { vscode } from '../../utils/vscode'
import Thumbnails from '../Thumbnails/Thumbnails'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import CreditsInfo from './CreditsInfo'
import TaskText from './TaskText'
import TokenInfo from './TokenInfo'
import BugReportDialog from './bug-report-dialog'

interface TaskHeaderProps {
	task: ClaudeMessage
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
	task,
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
	const { currentTaskId, currentTask } = useExtensionState()
	const [isOpen, setIsOpen] = React.useState(true)

	const handleDownload = () => {
		vscode.postMessage({ type: 'exportCurrentTask' })
	}
	const handleRename = () => {
		vscode.postMessage({ type: 'renameTask', isCurentTask: true })
	}

	return (
		<section className="pb-1">
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<div className="flex flex-wrap">
					<h3 className="uppercase">Task</h3>
					<div style={{ flex: '1 1 0%' }} />
					<BugReportDialog />
					<VSCodeButton appearance="icon" onClick={handleRename}>
						Rename
					</VSCodeButton>
					<VSCodeButton appearance="icon" onClick={handleDownload}>
						Export
					</VSCodeButton>
					<VSCodeButton appearance="icon" onClick={onClose}>
						<span className="codicon codicon-close" />
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
							{isOpen ? 'Collapse' : 'Expand'}
						</TooltipContent>
					</Tooltip>
					<div className="basis-full flex">
						<AnimatePresence mode="wait">
							<motion.div
								key={currentTask?.name ?? currentTask?.task ?? task.text}
								initial={{ opacity: 0.6 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0.6 }}
								className="w-full"
								transition={{ duration: 0.2 }}
							>
								<TaskText text={currentTask?.name ?? currentTask?.task ?? task.text} />
							</motion.div>
						</AnimatePresence>
					</div>
				</div>

				<CollapsibleContent className="flex flex-col pt-1 gap-2">
					<AnimatePresence mode="wait">
						<motion.div
							className="flex flex-col pt-1 gap-2 w-full"
							key={currentTask?.name ?? currentTask?.task ?? task.text}
							initial={{ opacity: 0.6 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0.6 }}
							transition={{ duration: 0.5 }}
						>
							{task.images && task.images.length > 0 && <Thumbnails images={task.images} />}
							<TokenInfo
								tokensIn={tokensIn}
								tokensOut={tokensOut}
								doesModelSupportPromptCache={doesModelSupportPromptCache}
								cacheWrites={cacheWrites}
								cacheReads={cacheReads}
								totalCost={totalCost}
							/>
						</motion.div>
					</AnimatePresence>
					<CreditsInfo koduCredits={koduCredits} vscodeUriScheme={vscodeUriScheme} />
				</CollapsibleContent>
			</Collapsible>
		</section>
	)
}
