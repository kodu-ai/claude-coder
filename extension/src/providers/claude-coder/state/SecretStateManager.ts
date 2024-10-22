import type * as vscode from 'vscode'
import { HistoryItem } from '../../../shared/HistoryItem'

const secretKeys = ['koduApiKey'] as const

type SecretState = {
	koduApiKey: string
	fp: string
}

export class SecretStateManager {
	constructor(private context: vscode.ExtensionContext) {}

	async updateSecretState<K extends keyof SecretState>(key: K, value: SecretState[K]): Promise<void> {
		await this.context.secrets.store(key, value!)
	}

	async deleteSecretState<K extends keyof SecretState>(key: K): Promise<void> {
		await this.context.secrets.delete(key)
	}

	getSecretState<K extends keyof SecretState>(key: K): Promise<SecretState[K]> {
		return this.context.secrets.get(key) as Promise<SecretState[K]>
	}

	async resetState(): Promise<void> {
		for (const key of secretKeys) {
			await this.context.secrets.delete(key)
		}
	}
}
