import * as vscode from "vscode"
import { HistoryItem } from "../../shared/history-item"
import { KoduModelId } from "../../shared/api"
import { ToolName } from "../../agent/v1/tools/types"

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
	apiModelId: "claude-3-5-sonnet-20241022",
	browserModelId: "claude-3-5-haiku-20241022",
}

export type GlobalState = {
	user: User | undefined | null
	terminalCompressionThreshold: number | undefined
	lastShownAnnouncementId: string | undefined
	customInstructions: string | undefined
	gitHandlerEnabled: boolean | undefined
	apiModelId: KoduModelId | undefined
	browserModelId: KoduModelId | undefined
	alwaysAllowReadOnly: boolean | undefined
	alwaysAllowWriteOnly: boolean | undefined
	inlineEditOutputType?: "full" | "diff"
	autoSummarize: boolean | undefined
	taskHistory: HistoryItem[] | undefined
	autoCloseTerminal: boolean | undefined
	skipWriteAnimation: boolean | undefined
	commandTimeout: number | undefined
	activePromptName: string | undefined
	disabledTools: ToolName[] | undefined
	/**
	 * if number is set, the observer hook will be called every n-th time (which means that the hook is enabled)
	 */
	observerHookEvery: number | undefined
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
		if ((key === "apiModelId" || key === "browserModelId") && typeof keyData === "string") {
			return this.fixModelId(keyData) as GlobalState[K]
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

	private fixModelId(modelId: string): KoduModelId {
		// we update the models to the latest version
		if (modelId === "claude-3-5-sonnet-20240620") {
			return "claude-3-5-sonnet-20241022"
		}
		if (modelId === "claude-3-haiku-20240307") {
			return "claude-3-5-haiku-20241022"
		}
		return modelId
	}
}
