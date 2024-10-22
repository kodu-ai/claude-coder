import * as vscode from 'vscode'
import { fetchKoduUser as fetchKoduUserAPI, initVisitor } from '../../../api/kodu'
import { ApiModelId, type KoduModelId, koduDefaultModelId, koduModels } from '../../../shared/api'
import type { ExtensionProvider } from '../ClaudeCoderProvider'

type SecretKey = 'koduApiKey'

export class ApiManager {
	constructor(private context: ExtensionProvider) {}

	async updateApiConfiguration(apiConfiguration: { apiModelId?: KoduModelId; koduApiKey?: string }) {
		const { apiModelId, koduApiKey } = apiConfiguration
		await this.context.getGlobalStateManager().updateGlobalState('apiModelId', apiModelId)
		if (koduApiKey) {
			await this.context.getSecretStateManager().updateSecretState('koduApiKey', koduApiKey)
		}
	}

	async initFreeTrialUser(visitorId: string) {
		this.context.getSecretStateManager().updateSecretState('fp', visitorId)
		const data = await initVisitor({ visitorId })
		console.log('initVisitor data', data)
		if (data) {
			await this.saveKoduApiKey(data.apiKey)
		}
	}

	async saveKoduApiKey(apiKey: string) {
		await this.context.getSecretStateManager().updateSecretState('koduApiKey', apiKey)
		console.log('Saved Kodu API key')
		const modelId = await this.context.getKoduDev()?.getStateManager().apiManager.getModelId()
		await this.context
			.getKoduDev()
			?.getStateManager()
			.apiManager.updateApi({
				koduApiKey: apiKey,
				apiModelId:
					modelId ?? this.context.getGlobalStateManager().getGlobalState('apiModelId') ?? koduDefaultModelId,
			})
		// await this.context.globalState.update("shouldShowKoduPromo", false)
		const user = await this.fetchKoduUser(apiKey)
		// await this.context.globalState.update("user", user)
		await this.context.getGlobalStateManager().updateGlobalState('user', user)
		await this.context.getWebviewManager().postStateToWebview()
		console.log('Posted state to webview after saving Kodu API key')
		await this.context.getWebviewManager().postMessageToWebview({ type: 'action', action: 'koduAuthenticated' })
		console.log('Posted message to action: koduAuthenticated')
	}

	async signOutKodu() {
		await this.context.getSecretStateManager().deleteSecretState('koduApiKey')
		await this.context.getGlobalStateManager().updateGlobalState('user', undefined)
	}

	async fetchKoduCredits() {
		const koduApiKey = await this.context.getSecretStateManager().getSecretState('koduApiKey')
		if (koduApiKey) {
			const user = await this.fetchKoduUser(koduApiKey)
			if (user) {
				await this.context.getGlobalStateManager().updateGlobalState('user', user)
			}
		}
	}

	private async fetchKoduUser(apiKey: string) {
		return await fetchKoduUserAPI({ apiKey })
	}
}
