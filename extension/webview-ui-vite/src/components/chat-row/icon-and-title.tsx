import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { ClaudeAsk, ClaudeSay } from "extension/shared/messages/extension-message"

interface IconAndTitleProps {
	type: ClaudeAsk | ClaudeSay | undefined
	isCommandExecuting: boolean
	cost?: number
	apiRequestFailedMessage?: string | boolean
	isCompleted?: boolean
}

const IconAndTitle = ({ type, isCommandExecuting, cost, apiRequestFailedMessage, isCompleted }: IconAndTitleProps) => {
	const ProgressIndicator = (
		<div
			style={{
				width: "16px",
				height: "16px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}>
			<div style={{ transform: "scale(0.55)", transformOrigin: "center" }}>
				<VSCodeProgressRing />
			</div>
		</div>
	)

	switch (type) {
		case "api_req_failed":
			return [
				<span className="codicon codicon-error text-error" />,
				<h3 className="text-error">Request Failed</h3>,
			]
		case "error":
			return [<span className="codicon codicon-error text-error" />, <h3 className="text-error">Error</h3>]
		case "command":
			return [
				isCommandExecuting ? ProgressIndicator : <span className="codicon codicon-terminal text-alt" />,
				<h3 className="text-alt">Kodu wants to execute this command:</h3>,
			]
		case "completion_result":
			return [
				<span className="codicon codicon-check text-success" />,
				<h3 className="text-success">Task Completed</h3>,
			]
		case "api_req_started":
			return [
				cost ? (
					<span className="codicon codicon-check text-success" />
				) : apiRequestFailedMessage ? (
					<span className="codicon codicon-error text-error" />
				) : (
					ProgressIndicator
				),
				cost || (isCompleted && !apiRequestFailedMessage) ? (
					<h3 className="text-success">Request Complete</h3>
				) : apiRequestFailedMessage ? (
					<h3 className="text-error">Request Failed</h3>
				) : (
					<h3 className="text-alt">Making Request...</h3>
				),
			]
		case "followup":
			return [
				<span className="codicon codicon-question text-alt" />,
				<h3 className="text-alt">Kodu has a question:</h3>,
			]
		default:
			return [null, null]
	}
}

export default IconAndTitle
