import { VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react'
import type React from 'react'
import type { ModelInfo } from '../../../../src/shared/api'

interface ModelDropdownProps {
	selectedModelId: string
	models: Record<string, ModelInfo>
	onChange: (event: any) => void
}

const ModelDropdown: React.FC<ModelDropdownProps> = ({ selectedModelId, models, onChange }) => (
	<VSCodeDropdown id="model-id" value={selectedModelId} onChange={onChange} style={{ width: '100%' }}>
		<VSCodeOption value="">Select a model...</VSCodeOption>
		{Object.keys(models).map((modelId) => (
			<VSCodeOption
				key={modelId}
				value={modelId}
				style={{
					whiteSpace: 'normal',
					wordWrap: 'break-word',
					maxWidth: '100%',
				}}
			>
				{modelId}
			</VSCodeOption>
		))}
	</VSCodeDropdown>
)

export default ModelDropdown
