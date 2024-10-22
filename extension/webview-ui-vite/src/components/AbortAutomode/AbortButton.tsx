import { VSCodeButton } from '@vscode/webview-ui-toolkit/react'
import type React from 'react'

interface AbortButtonProps {
	isDisabled: boolean
	isAborting: boolean
	onClick: () => void
}

const AbortButton: React.FC<AbortButtonProps> = ({ isDisabled, isAborting, onClick }) => (
	<VSCodeButton disabled={isDisabled} appearance="secondary" onClick={onClick} style={{ marginRight: '10px' }}>
		{isAborting ? 'Aborting...' : 'Quit Automode'}
	</VSCodeButton>
)

export default AbortButton
