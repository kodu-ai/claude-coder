import { VSCodeButton } from '@vscode/webview-ui-toolkit/react'
import type React from 'react'

interface ButtonProps {
	text: string
	appearance: 'primary' | 'secondary'
	disabled: boolean
	onClick: () => void
	className: string
}

const Button: React.FC<ButtonProps> = ({ text, appearance, disabled, onClick, className }) => (
	<VSCodeButton appearance={appearance} disabled={disabled} onClick={onClick} className={className}>
		{text}
	</VSCodeButton>
)

export default Button
