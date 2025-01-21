import * as vscode from "vscode"
import { HistoryItem } from "../../shared/history-item"
import { ToolName } from "../../agent/v1/tools/types"
import { ProviderId } from "../../api/providers/constants"
import { ApiConfiguration } from "../../api"

type User = {
	email: string
	credits: number
	id: string
	isVisitor: boolean
}

const defaults: Partial<GlobalState> = {
	inlineEditOutputType: "full",
	autoSummarize: true,
	gitHandlerEnabled: false,
	gitCommitterType: "kodu",
	apiConfig: {
		providerId: "kodu",
		modelId: "claude-3-5-sonnet-20241022",
		koduApiKey: "-",
	},
}

export type GlobalState = {
	user: User | undefined | null
	terminalCompressionThreshold: number | undefined
	lastShownAnnouncementId: string | undefined
	customInstructions: string | undefined
	apiConfig?: Partial<ApiConfiguration>
	gitHandlerEnabled: boolean | undefined
	gitCommitterType: "kodu" | "user" | undefined
	alwaysAllowReadOnly: boolean | undefined
	alwaysAllowWriteOnly: boolean | undefined
	inlineEditOutputType?: "full" | "diff"
	autoSummarize: boolean | undefined
	taskHistory: HistoryItem[] | undefined
	autoCloseTerminal: boolean | undefined
	skipWriteAnimation: boolean | undefined
	commandTimeout: number | undefined
	activePromptName: string | undefined
	observerModel:
		| {
				modelId: string
				providerId: ProviderId
		  }
		| undefined
	disabledTools: ToolName[] | undefined
	/**
	 * if number is set, the observer hook will be called every n-th time (which means that the hook is enabled)
	 */
	observerHookEvery: number | undefined
	isMigratedTaskCompleted: boolean | undefined
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
		const keyData = this.context.globalState.get(key)
		if (keyData === undefined) {
			return this.getKeyDefaultValue(key)
		}

		return keyData as GlobalState[K]
	}

	async resetState(): Promise<void> {
		for (const key of this.context.globalState.keys()) {
			await this.context.globalState.update(key, undefined)
		}
	}
	private getKeyDefaultValue<K extends keyof GlobalState>(key: K): GlobalState[K] {
		if (key in defaults) {
			return defaults[key] as GlobalState[K]
		}
		return undefined
	}
}
