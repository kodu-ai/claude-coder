import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { ClaudeMessage } from "../../../../src/shared/ExtensionMessage"
import { vscode } from "../../utils/vscode"
import Thumbnails from "../Thumbnails/Thumbnails"
import { ApiProvider } from "../../../../src/shared/api"
import TaskText from "./TaskText"
import TokenInfo from "./TokenInfo"
import CreditsInfo from "./CreditsInfo"
import { useExtensionState } from "@/context/ExtensionStateContext"

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

const TaskHeader: React.FC<TaskHeaderProps> = ({
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
}) => {
	const { currentTaskId, currentTask } = useExtensionState()

	const handleDownload = () => {
		vscode.postMessage({ type: "exportCurrentTask" })
	}
	const handleRename = () => {
		vscode.postMessage({ type: "renameTask", isCurentTask: true })
	}
	console.log(`TaskHeader: ${currentTaskId} name ${currentTask?.name}`)

	return (
		<>
			<section>
				<div className="flex-line">
					<h3 className="uppercase">Task</h3>
					<div style={{ flex: "1 1 0%" }}></div>
					<VSCodeButton appearance="icon" onClick={handleRename}>
						Rename
					</VSCodeButton>
					<VSCodeButton appearance="icon" onClick={handleDownload}>
						Export
					</VSCodeButton>
					<VSCodeButton appearance="icon" onClick={onClose}>
						<span className="codicon codicon-close"></span>
					</VSCodeButton>
				</div>
				<TaskText text={currentTask?.name ?? currentTask?.task ?? task.text} />
				{task.images && task.images.length > 0 && <Thumbnails images={task.images} />}
				<TokenInfo
					tokensIn={tokensIn}
					tokensOut={tokensOut}
					doesModelSupportPromptCache={doesModelSupportPromptCache}
					cacheWrites={cacheWrites}
					cacheReads={cacheReads}
					totalCost={totalCost}
				/>
			</section>
			<CreditsInfo koduCredits={koduCredits} vscodeUriScheme={vscodeUriScheme} />
		</>
	)
}

export default TaskHeader
