import { VSCodeRadio, VSCodeRadioGroup } from '@vscode/webview-ui-toolkit/react'
import type React from 'react'
import type { GlobalState } from '../../../../src/providers/claude-coder/state/GlobalStateManager'
import { technicalLevels } from '../onboarding'

interface TechnicalLevelSelectorProps {
	technicalBackground: GlobalState['technicalBackground']
	setTechnicalBackground: (mode: GlobalState['technicalBackground']) => void
}

const TechnicalLevelSelector: React.FC<TechnicalLevelSelectorProps> = ({
	technicalBackground: creativeMode,
	setTechnicalBackground: setCreativeMode,
}) => (
	<div style={{ marginBottom: 5 }}>
		<span style={{ fontWeight: '500' }}>Select Technical Level:</span>
		<VSCodeRadioGroup value={creativeMode} onChange={(e: any) => setCreativeMode(e.target.value)}>
			{Object.entries(technicalLevels).map(([key, value]) => (
				<VSCodeRadio key={key} value={key}>
					{value.title as unknown as GlobalState['technicalBackground']}
				</VSCodeRadio>
			))}
		</VSCodeRadioGroup>
		<p
			style={{
				fontSize: '12px',
				marginTop: '5px',
				color: 'var(--vscode-descriptionForeground)',
			}}
		>
			{/* {modeDescriptions[creativeMode as keyof typeof modeDescriptions]} */}
			{technicalLevels[creativeMode as keyof typeof technicalLevels].description}
		</p>
	</div>
)

export default TechnicalLevelSelector
