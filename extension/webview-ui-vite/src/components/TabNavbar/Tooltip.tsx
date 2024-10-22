import type React from 'react'

export interface TooltipProps {
	text: string
	isVisible: boolean
	position: { x: number; y: number }
	align?: 'left' | 'center' | 'right'
}

const Tooltip: React.FC<TooltipProps> = ({ text, isVisible, position, align = 'center' }) => {
	let leftPosition = position.x
	let triangleStyle: React.CSSProperties = {
		left: '50%',
		marginLeft: '-5px',
	}

	if (align === 'right') {
		leftPosition = position.x - 10
		triangleStyle = {
			right: '10px',
			marginLeft: '0',
		}
	} else if (align === 'left') {
		leftPosition = position.x + 10
		triangleStyle = {
			left: '10px',
			marginLeft: '0',
		}
	}

	return (
		<div
			style={{
				position: 'fixed',
				top: `${position.y}px`,
				left: align === 'center' ? `${leftPosition}px` : 'auto',
				right: align === 'right' ? '10px' : 'auto',
				transform: align === 'center' ? 'translateX(-50%)' : 'none',
				opacity: isVisible ? 1 : 0,
				visibility: isVisible ? 'visible' : 'hidden',
				transition: 'opacity 0.1s ease-out 0.1s, visibility 0.1s ease-out 0.1s',
				backgroundColor: 'var(--vscode-editorHoverWidget-background)',
				color: 'var(--vscode-editorHoverWidget-foreground)',
				padding: '4px 8px',
				borderRadius: '3px',
				fontSize: '12px',
				pointerEvents: 'none',
				zIndex: 1000,
				boxShadow: '0 2px 8px var(--vscode-widget-shadow)',
				border: '1px solid var(--vscode-editorHoverWidget-border)',
				textAlign: 'center',
				whiteSpace: 'nowrap',
			}}
		>
			<div
				style={{
					position: 'absolute',
					top: '-5px',
					...triangleStyle,
					borderLeft: '5px solid transparent',
					borderRight: '5px solid transparent',
					borderBottom: '5px solid var(--vscode-editorHoverWidget-border)',
				}}
			/>
			<div
				style={{
					position: 'absolute',
					top: '-4px',
					...triangleStyle,
					borderLeft: '5px solid transparent',
					borderRight: '5px solid transparent',
					borderBottom: '5px solid var(--vscode-editorHoverWidget-background)',
				}}
			/>
			{text}
		</div>
	)
}

export default Tooltip
