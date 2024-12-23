import * as vscode from "vscode"

const secretKeys = ["koduApiKey"] as const

type SecretState = {
	koduApiKey: string
	fp: string
}

export class SecretStateManager {
	private static instance: SecretStateManager | null = null
	private context: vscode.ExtensionContext

	private constructor(context: vscode.ExtensionContext) {
		this.context = context
	}

	public static getInstance(context?: vscode.ExtensionContext): SecretStateManager {
		if (!SecretStateManager.instance) {
			if (!context) {
				throw new Error("Context must be provided when creating the SecretStateManager instance")
			}
			SecretStateManager.instance = new SecretStateManager(context)
		}
		return SecretStateManager.instance
	}

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
