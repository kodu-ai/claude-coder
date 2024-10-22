import { VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react'
import type React from 'react'

interface CheckboxOptionProps {
	checked: boolean
	onChange: (checked: boolean) => void
	label: string
	description: string
}

const CheckboxOption: React.FC<CheckboxOptionProps> = ({ checked, onChange, label, description }) => (
	<div style={{ marginBottom: 5 }}>
		<VSCodeCheckbox checked={checked} onChange={(e: any) => onChange(!!e.target?.checked)}>
			<span style={{ fontWeight: '500' }}>{label}</span>
		</VSCodeCheckbox>
		<p
			style={{
				fontSize: '12px',
				marginTop: '5px',
				color: 'var(--vscode-descriptionForeground)',
			}}
		>
			{description}
		</p>
	</div>
)

export default CheckboxOption
