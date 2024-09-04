import React from "react"
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { ClaudeAsk, ClaudeSay } from "../../../../src/shared/ExtensionMessage"

interface IconAndTitleProps {
	type: ClaudeAsk | ClaudeSay | undefined
	isCommandExecuting: boolean
	cost?: number
	apiRequestFailedMessage?: string
}

const IconAndTitle = ({ type, isCommandExecuting, cost, apiRequestFailedMessage }: IconAndTitleProps) => {
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
		case "error":
			return [<span className="codicon codicon-error text-error" />, <h3 className="text-error">Error</h3>]
		case "command":
			return [
				isCommandExecuting ? ProgressIndicator : <span className="codicon codicon-terminal text-alt" />,
				<h3 className="text-alt">Claude wants to execute this command:</h3>,
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
				cost ? (
					<h3 className="text-success">API Request Complete</h3>
				) : apiRequestFailedMessage ? (
					<h3 className="text-error">API Request Failed</h3>
				) : (
					<h3 className="text-alt">Making API Request...</h3>
				),
			]
		case "followup":
			return [
				<span className="codicon codicon-question text-alt" />,
				<h3 className="text-alt">Claude has a question:</h3>,
			]
		default:
			return [null, null]
	}
}

export default IconAndTitle
