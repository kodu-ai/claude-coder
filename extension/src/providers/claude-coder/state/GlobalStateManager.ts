import * as vscode from "vscode"
import { HistoryItem } from "../../../shared/HistoryItem"
import { ApiModelId, KoduModelId, koduModels } from "../../../shared/api"
import { SystemPromptVariant } from "../../../shared/SystemPromptVariant"
import * as path from "path"
import { getCwd } from "../../../agent/v1/utils"

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
	terminalCompressionThreshold: number | undefined
	lastShownAnnouncementId: string | undefined
	customInstructions: string | undefined
	isAdvanceThinkingEnabled: boolean | undefined
	isInlineEditingEnabled: boolean | undefined
	apiModelId: KoduModelId | undefined
	browserModelId: string | undefined
	useUdiff: boolean | undefined
	alwaysAllowReadOnly: boolean | undefined
	alwaysAllowWriteOnly: boolean | undefined
	inlineEditOutputType?: "full" | "diff" | "none"
	autoSummarize: boolean | undefined
	taskHistory: HistoryItem[] | undefined
	shouldShowKoduPromo: boolean | undefined
	creativeMode: CreativeMode | undefined
	autoCloseTerminal: boolean | undefined
	experimentalTerminal: boolean | undefined
	isContinueGenerationEnabled: boolean | undefined
	skipWriteAnimation: boolean | undefined
	technicalBackground: "no-technical" | "technical" | "developer" | undefined
	systemPromptVariants: SystemPromptVariant[] | undefined
	activeSystemPromptVariantId: string | undefined
	commandTimeout: number | undefined
}

export class GlobalStateManager {
	private static instance: GlobalStateManager | null = null
	private context: vscode.ExtensionContext

	private constructor(context: vscode.ExtensionContext) {
		this.context = context
		this.initializeSystemPrompts()
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

	public async initializeSystemPrompts() {
		try {
			// Initialize default system prompt variants if none exist
			const activeId = this.getGlobalState("activeSystemPromptVariantId")

			// Import and update prompt files
			const promptFiles = {
				"m-11-1-2024": () => import("../../../agent/v1/prompts/m-11-1-2024.prompt"),
				"c-11-1-2024": () => import("../../../agent/v1/prompts/c-11-1-2024.prompt"),
			}

			const variants: SystemPromptVariant[] = []

			for (const [id, importFn] of Object.entries(promptFiles)) {
				try {
					const module = await importFn()
					const name = id
						.replace(/[-_]/g, " ")
						.split(" ")
						.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
						.join(" ")
					const modelId = await this.getGlobalState("apiModelId")
					const supportImages = koduModels[(modelId as KoduModelId) ?? ""]?.supportsImages ?? false
					const content = await module.default.prompt(
						getCwd(),
						supportImages,
						this.getGlobalState("technicalBackground")
					)

					variants.push({
						id,
						name,
						content,
					})
				} catch (error) {
					console.error(`Error importing prompt file ${id}:`, error)
				}
			}
			// set the system prompt variants
			await this.updateGlobalState("systemPromptVariants", variants)
			// now check if the active system prompt variant is set and is valid otherwise set m-11-1-2024 as the active system prompt variant
			if (!activeId || !variants.find((v) => v.id === activeId)) {
				await this.updateGlobalState("activeSystemPromptVariantId", "m-11-1-2024")
			}
		} catch (error) {
			console.error("Error initializing system prompts:", error)
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
		if (!variants || !activeId) {
			return undefined
		}

		const activeVariant = variants.find((v) => v.id === activeId)
		return activeVariant?.content
	}
}
