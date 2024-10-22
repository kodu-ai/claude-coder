import type { ApiConfiguration } from '../../../../src/api'
import { type ApiModelId, type ModelInfo, koduDefaultModelId, koduModels } from '../../../../src/shared/api'

export const formatPrice = (price: number) => {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(price)
}

export function normalizeApiConfiguration(apiConfiguration?: ApiConfiguration) {
	const modelId = apiConfiguration?.apiModelId

	const getProviderData = (models: Record<string, ModelInfo>, defaultId: ApiModelId) => {
		let selectedModelId: ApiModelId
		let selectedModelInfo: ModelInfo
		if (modelId && modelId in models) {
			selectedModelId = modelId
			selectedModelInfo = models[modelId]
		} else {
			selectedModelId = defaultId
			selectedModelInfo = models[defaultId]
		}
		return { selectedProvider: 'kodu', selectedModelId, selectedModelInfo }
	}

	return getProviderData(koduModels, koduDefaultModelId)
}
