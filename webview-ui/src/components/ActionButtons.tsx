import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

interface ActionButtonsProps {
	primaryButtonText: string | undefined
	secondaryButtonText: string | undefined
	enableButtons: boolean
	handlePrimaryButtonClick: () => void
	handleSecondaryButtonClick: () => void
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
	primaryButtonText,
	secondaryButtonText,
	enableButtons,
	handlePrimaryButtonClick,
	handleSecondaryButtonClick,
}) => {
	if (!primaryButtonText && !secondaryButtonText) return null

	return (
		<div className="action-buttons">
			{primaryButtonText && (
				<VSCodeButton
					appearance="primary"
					disabled={!enableButtons}
					onClick={handlePrimaryButtonClick}
					className="primary-button">
					{primaryButtonText}
				</VSCodeButton>
			)}
			{secondaryButtonText && (
				<VSCodeButton
					appearance="secondary"
					disabled={!enableButtons}
					onClick={handleSecondaryButtonClick}
					className="secondary-button">
					{secondaryButtonText}
				</VSCodeButton>
			)}
		</div>
	)
}

export default ActionButtons