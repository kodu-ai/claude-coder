import * as vscode from "vscode"
import { HistoryItem } from "../../shared/history-item"
import { ToolName } from "../../agent/v1/tools/types"
import { ProviderId } from "../../api/providers/constants"
import { ApiConfiguration } from "../../api"
import { merge } from "lodash"

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
	mcpServers: {},
	disabledTools: [],
}

export interface McpServer {
	command: string
	args?: string[]
	env?: Record<string, string>
	disabled?: boolean
}

export type GlobalState = {
	user: User | undefined | null
	terminalCompressionThreshold: number | undefined
	mcpServers: Record<string, McpServer>
	lastShownAnnouncementId: string | undefined
	customInstructions: string | undefined
	apiConfig?: Partial<ApiConfiguration>
	gitHandlerEnabled: boolean | undefined
	gitCommitterType: "kodu" | "user" | undefined
	readFileMaxLines: number | undefined
	alwaysAllowReadOnly: boolean | undefined
	alwaysAllowWriteOnly: boolean | undefined
	inlineEditOutputType?: "full" | "diff"
	autoSummarize: boolean | undefined
	taskHistory: HistoryItem[] | undefined
	autoCloseTerminal: boolean | undefined
	skipWriteAnimation: boolean | undefined
	commandTimeout: number | undefined
	activePromptName: string | undefined
	observerSettings:
		| {
				/**
				 * The model ID to use for the observer
				 */
				modelId: string
				/**
				 * The provider ID that is associated with the model
				 */
				providerId: ProviderId
				/**
				 * The number of last messages to pull to the observer for observation
				 */
				observePullMessages: number
				/**
				 * The number of requests to make before triggering the observer
				 */
				observeEveryXRequests: number
				/**
				 * Custom prompt to use for the observer
				 */
				observePrompt?: string
		  }
		| undefined
	disabledTools: ToolName[] | undefined
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

	async updatePartialGlobalState<K extends keyof GlobalState>(key: K, value: Partial<GlobalState[K]>): Promise<void> {
		const currentValue = this.getGlobalState(key)
		const deepMerged = merge({}, currentValue, value)
		await this.context.globalState.update(key, deepMerged)
	}

	async updateGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]): Promise<void> {
		await this.context.globalState.update(key, value)
	}

	getGlobalState<K extends keyof GlobalState>(key: K): GlobalState[K] | undefined {
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
	private getKeyDefaultValue<K extends keyof GlobalState>(key: K): GlobalState[K] | undefined {
		if (key in defaults) {
			return defaults[key] as GlobalState[K]
		}
		return undefined
	}
}
