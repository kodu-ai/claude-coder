import React, { useEffect } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { vscode } from "../utils/vscode"
import { useExtensionState } from "../context/ExtensionStateContext"

interface AbortAutomodeProps {
	isVisible: boolean
}

const AbortAutomode: React.FC<AbortAutomodeProps> = ({ isVisible }) => {
	const [isAborting, setIsAborting] = React.useState(false)
	const { claudeMessages: messages } = useExtensionState()

	const lastMessage = messages[messages.length - 1]

	const handleAbort = () => {
		setIsAborting(true)
		vscode.postMessage({ type: "abortAutomode" })
	}

	useEffect(() => {
		if (lastMessage.say === "abort_automode") {
			setIsAborting(false)
		}
	}, [lastMessage])

	return (
		<div
			style={{
				display: "flex",
				padding: "10px 15px 0px 15px",
			}}>
			<VSCodeButton
				disabled={!isVisible || isAborting}
				appearance="secondary"
				onClick={handleAbort}
				style={{ marginRight: "10px" }}>
				{isAborting ? "Aborting..." : "Quit Automode"}
			</VSCodeButton>
		</div>
	)
}

export default AbortAutomode
