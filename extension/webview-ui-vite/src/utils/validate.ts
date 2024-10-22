import type { ApiConfiguration } from '../../../src/shared/api'

export function validateApiConfiguration(apiConfiguration?: ApiConfiguration): string | undefined {
	if (apiConfiguration) {
		switch (apiConfiguration.apiProvider) {
			case 'anthropic':
				if (!apiConfiguration.apiKey) {
					return 'You must provide a valid API key or choose a different provider.'
				}
				break
			case 'bedrock':
				if (!apiConfiguration.awsAccessKey || !apiConfiguration.awsSecretKey || !apiConfiguration.awsRegion) {
					return 'You must provide a valid AWS access key, secret key, and region.'
				}
				break
			case 'openrouter':
				if (!apiConfiguration.openRouterApiKey) {
					return 'You must provide a valid API key or choose a different provider.'
				}
				break
			case 'vertex':
				if (!apiConfiguration.vertexProjectId || !apiConfiguration.vertexRegion) {
					return 'You must provide a valid Google Cloud Project ID and Region.'
				}
				break
		}
	}
	return undefined
}

export function validateMaxRequestsPerTask(maxRequestsPerTask?: string): string | undefined {
	if (maxRequestsPerTask?.trim()) {
		const num = Number(maxRequestsPerTask)
		if (Number.isNaN(num) || num < 3 || num > 100) {
			return 'Maximum requests must be between 3 and 100'
		}
	}
	return undefined
}
