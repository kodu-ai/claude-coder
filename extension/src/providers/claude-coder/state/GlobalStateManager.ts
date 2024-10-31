import * as vscode from "vscode"
import { HistoryItem } from "../../../shared/HistoryItem"
import { ApiModelId, KoduModelId } from "../../../shared/api"
import { SystemPromptVariant } from "../../../shared/SystemPromptVariant"

type User = {
	email: string
	credits: number
	id: string
	isVisitor: boolean
}

type CreativeMode = "creative" | "normal" | "deterministic"

export type GlobalState = {
	user: User | undefined | null
	maxRequestsPerTask: number | undefined
	lastShownAnnouncementId: string | undefined
	customInstructions: string | undefined
	apiModelId: KoduModelId | undefined
	browserModelId: string | undefined
	useUdiff: boolean | undefined
	alwaysAllowReadOnly: boolean | undefined
	alwaysAllowWriteOnly: boolean | undefined
	taskHistory: HistoryItem[] | undefined
	shouldShowKoduPromo: boolean | undefined
	creativeMode: CreativeMode | undefined
	autoCloseTerminal: boolean | undefined
	experimentalTerminal: boolean | undefined
	skipWriteAnimation: boolean | undefined
	technicalBackground: "no-technical" | "technical" | "developer" | undefined
	systemPromptVariants: SystemPromptVariant[] | undefined
	activeSystemPromptVariantId: string | undefined
}

export class GlobalStateManager {
	constructor(private context: vscode.ExtensionContext) {
		// Initialize default system prompt variants if none exist
		const variants = this.getGlobalState("systemPromptVariants")
		if (!variants || variants.length === 0) {
			import("../../../agent/v1/prompts/default-system-prompts").then(({ defaultSystemPrompts }) => {
				this.updateGlobalState("systemPromptVariants", defaultSystemPrompts)
				// Set the first variant as active by default
				this.updateGlobalState("activeSystemPromptVariantId", defaultSystemPrompts[0].id)
			})
		}
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

	getActiveSystemPrompt(): string | undefined {
		const variants = this.getGlobalState("systemPromptVariants")
		const activeId = this.getGlobalState("activeSystemPromptVariantId")
		if (!variants || !activeId) return undefined

		const activeVariant = variants.find(v => v.id === activeId)
		return activeVariant?.content
	}
}