// providers/deepseek.ts
import { ProviderConfig } from "../types"
import { DEFAULT_BASE_URLS, PROVIDER_IDS, PROVIDER_NAMES } from "../constants"

export const openaiCompatible: ProviderConfig = {
	id: PROVIDER_IDS.OPENAICOMPATIBLE,
	name: PROVIDER_NAMES[PROVIDER_IDS.OPENAICOMPATIBLE],
	baseUrl: DEFAULT_BASE_URLS[PROVIDER_IDS.DEEPSEEK],
	models: [],
	requiredFields: [],
	isProviderCustom: true,
}
