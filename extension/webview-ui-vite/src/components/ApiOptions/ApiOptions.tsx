import { VSCodeLink } from '@vscode/webview-ui-toolkit/react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEvent } from 'react-use'
import type { ApiConfiguration } from '../../../../src/api'
import type { ExtensionMessage } from '../../../../src/shared/ExtensionMessage'
import { koduModels } from '../../../../src/shared/api'
import { getKoduHomepageUrl } from '../../../../src/shared/kodu'
import { useExtensionState } from '../../context/ExtensionStateContext'
import { vscode } from '../../utils/vscode'
import ModelDropdown from './ModelDropdown'
import ModelInfoView from './ModelInfoView'
import UserInfo from './UserInfo'
import { normalizeApiConfiguration } from './utils'

interface ApiOptionsProps {
	showModelOptions: boolean
	setDidAuthKodu?: React.Dispatch<React.SetStateAction<boolean>>
}

const ApiOptions: React.FC<ApiOptionsProps> = ({ showModelOptions, setDidAuthKodu }) => {
	const { apiConfiguration, setApiConfiguration, user, uriScheme } = useExtensionState()
	const [, setDidFetchKoduCredits] = useState(false)

	const handleInputChange = (field: keyof ApiConfiguration) => (event: any) => {
		setApiConfiguration({ ...apiConfiguration, [field]: event.target.value })
	}

	const { selectedProvider, selectedModelId, selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	useEffect(() => {
		console.log('user', user)
		if (user === undefined) {
			setDidFetchKoduCredits(false)
			vscode.postMessage({ type: 'fetchKoduCredits' })
		}
	}, [selectedProvider, user])

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		switch (message.type) {
			case 'action':
				switch (message.action) {
					case 'koduCreditsFetched':
						setDidFetchKoduCredits(true)
						break
				}
				break
		}
	}, [])
	useEvent('message', handleMessage)

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
			<UserInfo user={user} uriScheme={uriScheme} setDidAuthKodu={setDidAuthKodu} />

			{showModelOptions && (
				<>
					<div className="dropdown-container">
						<label htmlFor="model-id">
							<span style={{ fontWeight: 500 }}>Model</span>
						</label>
						{selectedProvider === 'kodu' && (
							<ModelDropdown
								selectedModelId={selectedModelId}
								models={koduModels}
								onChange={handleInputChange('apiModelId')}
							/>
						)}
					</div>

					<ModelInfoView modelInfo={selectedModelInfo} />
				</>
			)}
		</div>
	)
}

export default ApiOptions
