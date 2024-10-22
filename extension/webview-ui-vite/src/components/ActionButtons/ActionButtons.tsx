import type React from 'react'
import Button from './Button'

interface ActionButtonsProps {
	primaryButtonText?: string
	secondaryButtonText?: string
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
	if (!primaryButtonText && !secondaryButtonText) {
		return null
	}

	return (
		<div className="action-buttons">
			{primaryButtonText && (
				<Button
					text={primaryButtonText}
					appearance="primary"
					disabled={!enableButtons}
					onClick={handlePrimaryButtonClick}
					className="primary-button"
				/>
			)}
			{secondaryButtonText && (
				<Button
					text={secondaryButtonText}
					appearance="secondary"
					disabled={!enableButtons}
					onClick={handleSecondaryButtonClick}
					className="secondary-button"
				/>
			)}
		</div>
	)
}

export default ActionButtons
