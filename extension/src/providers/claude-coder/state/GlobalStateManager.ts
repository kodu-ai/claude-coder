import * as vscode from "vscode"
import { HistoryItem } from "../../../shared/HistoryItem"
import { ApiModelId, KoduModelId } from "../../../shared/api"

type User = {
	email: string
	credits: number
	id: string
}

type CreativeMode = "creative" | "normal" | "deterministic"

export type GlobalState = {
	user: User | undefined | null
	maxRequestsPerTask: number | undefined
	lastShownAnnouncementId: string | undefined
	customInstructions: string | undefined
	apiModelId: KoduModelId | undefined
	useUdiff: boolean | undefined
	alwaysAllowReadOnly: boolean | undefined
	alwaysAllowWriteOnly: boolean | undefined
	taskHistory: HistoryItem[] | undefined
	shouldShowKoduPromo: boolean | undefined
	creativeMode: CreativeMode | undefined
	autoCloseTerminal: boolean | undefined
	experimentalTerminal: boolean | undefined
	summarizationThreshold: number | undefined
	skipWriteAnimation: boolean | undefined
	technicalBackground: "no-technical" | "technical" | "developer" | undefined
}

export class GlobalStateManager {
	constructor(private context: vscode.ExtensionContext) {}

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
