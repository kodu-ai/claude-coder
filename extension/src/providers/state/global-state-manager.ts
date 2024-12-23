import * as vscode from "vscode"
import { HistoryItem } from "../../shared/history-item"
import { KoduModelId } from "../../shared/api"

type User = {
	email: string
	credits: number
	id: string
	isVisitor: boolean
}

export type GlobalState = {
	user: User | undefined | null
	terminalCompressionThreshold: number | undefined
	lastShownAnnouncementId: string | undefined
	customInstructions: string | undefined
	gitHandlerEnabled: boolean | undefined
	apiModelId: KoduModelId | undefined
	browserModelId: string | undefined
	alwaysAllowReadOnly: boolean | undefined
	alwaysAllowWriteOnly: boolean | undefined
	inlineEditOutputType?: "full" | "diff"
	autoSummarize: boolean | undefined
	taskHistory: HistoryItem[] | undefined
	autoCloseTerminal: boolean | undefined
	skipWriteAnimation: boolean | undefined
	commandTimeout: number | undefined
}

export class GlobalStateManager {
	private static instance: GlobalStateManager | null = null
	private context: vscode.ExtensionContext

	private constructor(context: vscode.ExtensionContext) {
		this.context = context
	}

	public static getInstance(context?: vscode.ExtensionContext): GlobalStateManager {
		if (!GlobalStateManager.instance) {
			if (!context) {
				throw new Error("Context must be provided when creating the GlobalStateManager instance")
			}
			GlobalStateManager.instance = new GlobalStateManager(context)
		}
		return GlobalStateManager.instance
	}

	async updateGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]): Promise<void> {
		await this.context.globalState.update(key, value)
	}

	getGlobalState<K extends keyof GlobalState>(key: K): GlobalState[K] {
		return this.context.globalState.get(key) as GlobalState[K]
	}

	async resetState(): Promise<void> {
		for (const key of this.context.globalState.keys()) {
			await this.context.globalState.update(key, undefined)
		}
	}
}
