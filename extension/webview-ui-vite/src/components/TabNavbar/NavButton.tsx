import { VSCodeButton } from '@vscode/webview-ui-toolkit/react'
import type React from 'react'

interface NavButtonProps {
	onClick: () => void
	icon: string
	tooltip: string
	style: React.CSSProperties
	onShowTooltip: (text: string, event: React.MouseEvent, align: 'left' | 'center' | 'right') => void
	onHideTooltip: () => void
	tooltipAlign?: 'left' | 'center' | 'right'
}

const NavButton: React.FC<NavButtonProps> = ({
	onClick,
	icon,
	tooltip,
	style,
	onShowTooltip,
	onHideTooltip,
	tooltipAlign = 'center',
}) => (
	<VSCodeButton
		appearance="icon"
		onClick={onClick}
		style={style}
		onMouseEnter={(e) => onShowTooltip(tooltip, e, tooltipAlign)}
		onMouseLeave={onHideTooltip}
		onMouseMove={(e) => onShowTooltip(tooltip, e, tooltipAlign)}
	>
		<span className={`codicon codicon-${icon}`} />
	</VSCodeButton>
)

export default NavButton
