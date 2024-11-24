import * as vscode from "vscode"
import { ApiModelId } from "../../../shared/api"
import { GlobalStateManager } from "./GlobalStateManager"
import { ApiManager } from "./ApiManager"
import { HistoryItem } from "../../../shared/HistoryItem"
import { SecretStateManager } from "./SecretStateManager"
import { fetchKoduUser as fetchKoduUserAPI } from "../../../api/kodu"
import { ExtensionProvider } from "../ClaudeCoderProvider"
import { ExtensionState } from "../../../shared/ExtensionMessage"
import { SystemPromptVariant } from "../../../shared/SystemPromptVariant"
import { estimateTokenCount, estimateTokenCountFromMessages } from "../../../utils/context-management"
import { BASE_SYSTEM_PROMPT } from "../../../agent/v1/prompts/base-system"
import { getCwd } from "../../../agent/v1/utils"

/**
 * this at the current form can't be a singleton because it has dependicies on the KoduDev instance, and one extension can have multiple KoduDev instances
 */
export class StateManager {
	private globalStateManager: GlobalStateManager
	private secretStateManager: SecretStateManager
	private apiManager: ApiManager

	constructor(private context: ExtensionProvider) {
		this.globalStateManager = GlobalStateManager.getInstance(context.context)
		this.secretStateManager = SecretStateManager.getInstance(context.context)
		this.apiManager = ApiManager.getInstance(context)
	}

	async getState() {
		const [
			apiModelId,
			browserModelId,
			koduApiKey,
			user,
			maxRequestsPerTask,
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			taskHistory,
			shouldShowKoduPromo,
			creativeMode,
			fp,
			useUdiff,
			experimentalTerminal,
			technicalBackground,
			autoCloseTerminal,
			skipWriteAnimation,
			systemPromptVariants,
			activeSystemPromptVariantId,
			autoSummarize,
			isContinueGenerationEnabled,
		] = await Promise.all([
			this.globalStateManager.getGlobalState("apiModelId"),
			this.globalStateManager.getGlobalState("browserModelId"),
			this.secretStateManager.getSecretState("koduApiKey"),
			this.globalStateManager.getGlobalState("user"),
			this.globalStateManager.getGlobalState("maxRequestsPerTask"),
			this.globalStateManager.getGlobalState("lastShownAnnouncementId"),
			this.globalStateManager.getGlobalState("customInstructions"),
			this.globalStateManager.getGlobalState("alwaysAllowReadOnly"),
			this.globalStateManager.getGlobalState("alwaysAllowWriteOnly"),
			this.globalStateManager.getGlobalState("taskHistory"),
			this.globalStateManager.getGlobalState("shouldShowKoduPromo"),
			this.globalStateManager.getGlobalState("creativeMode"),
			this.secretStateManager.getSecretState("fp"),
			this.globalStateManager.getGlobalState("useUdiff"),
			this.globalStateManager.getGlobalState("experimentalTerminal"),
			this.globalStateManager.getGlobalState("technicalBackground"),
			this.globalStateManager.getGlobalState("autoCloseTerminal"),
			this.globalStateManager.getGlobalState("skipWriteAnimation"),
			this.globalStateManager.getGlobalState("systemPromptVariants"),
			this.globalStateManager.getGlobalState("activeSystemPromptVariantId"),
			this.globalStateManager.getGlobalState("autoSummarize"),
			this.globalStateManager.getGlobalState("isContinueGenerationEnabled"),
		])

		const currentTaskId = this.context.getKoduDev()?.getStateManager()?.state.taskId
		const currentClaudeMessage = this.context.getKoduDev()?.getStateManager()?.state.claudeMessages
		const currentApiHistory = await this.context.getKoduDev()?.getStateManager()?.getSavedApiConversationHistory()
		const activeVariant = systemPromptVariants?.find((variant) => variant.id === activeSystemPromptVariantId)
		let systemPrompt = ""

		// Get the active editor and file content
		const activeEditor = vscode.window.activeTextEditor
		let currentFileContent = ""
		let fileContext = ""
		
		if (activeEditor) {
			const document = activeEditor.document
			currentFileContent = document.getText()
			
			// Get diagnostics for the current file
			const diagnostics = vscode.languages.getDiagnostics(document.uri)
			if (diagnostics.length > 0) {
				// Build context about errors/warnings
				fileContext += "\nFILE DIAGNOSTICS:\n"
				diagnostics.forEach(diagnostic => {
					const startLine = diagnostic.range.start.line
					const endLine = diagnostic.range.end.line
					const severity = diagnostic.severity === vscode.DiagnosticSeverity.Error ? "ERROR" : "WARNING"
					
					// Get 3 lines before and after for context
					const startContextLine = Math.max(0, startLine - 3)
					const endContextLine = Math.min(document.lineCount - 1, endLine + 3)
					
					fileContext += `\n${severity} on lines ${startLine+1}-${endLine+1}: ${diagnostic.message}\n`
					fileContext += "Context:\n```\n"
					for (let i = startContextLine; i <= endContextLine; i++) {
						const line = document.lineAt(i).text
						fileContext += `${i === startLine ? ">" : " "} ${line}\n`
					}
					fileContext += "```\n"
				})
			}
		}

		if (activeVariant) {
			systemPrompt = activeVariant.content
		} else {
			const supportImages = this.apiManager.getCurrentModelInfo()?.supportsImages
			systemPrompt = await BASE_SYSTEM_PROMPT(getCwd(), supportImages ?? false, technicalBackground)
		}

		// Add current file content to system prompt if available
		if (currentFileContent) {
			systemPrompt += `\n\nCURRENT FILE CONTENT:\n\`\`\`\n${currentFileContent}\n\`\`\`\n`
			if (fileContext) {
				systemPrompt += fileContext
			}
		}

		const systemPromptTokens = estimateTokenCount({
			role: "assistant",
			content: [
				{
					type: "text",
					text: systemPrompt,
				},
			],
		})
		const tokens = estimateTokenCountFromMessages(currentApiHistory ?? []) + systemPromptTokens
		const currentContextWindow = this.context
			.getKoduDev()
			?.getStateManager()
			?.apiManager.getModelInfo()?.contextWindow

		return {
			apiConfiguration: {
				apiModelId,
				koduApiKey,
				browserModelId,
			},
			user,
			maxRequestsPerTask,
			lastShownAnnouncementId,
			customInstructions,
			technicalBackground,
			systemPromptVariants,
			activeSystemPromptVariantId,
			experimentalTerminal:
				experimentalTerminal === undefined || experimentalTerminal === null ? true : experimentalTerminal,
			currentTaskId,
			alwaysAllowReadOnly:
				alwaysAllowReadOnly === undefined || alwaysAllowReadOnly === null ? true : alwaysAllowReadOnly,
			shouldShowAnnouncement: lastShownAnnouncementId === undefined,
			claudeMessages: currentClaudeMessage ?? [],
			version: this.context.context.extension.packageJSON.version,
			fpjsKey: process.env.FPJS_API_KEY,
			alwaysAllowWriteOnly: alwaysAllowWriteOnly ?? false,
			taskHistory: taskHistory ?? [],
			shouldShowKoduPromo: shouldShowKoduPromo ?? true,
			creativeMode: creativeMode ?? "normal",
			fingerprint: fp,
			useUdiff: useUdiff ?? false,
			autoCloseTerminal: autoCloseTerminal ?? false,
			skipWriteAnimation: skipWriteAnimation ?? false,
			currentContextWindow: currentContextWindow ?? 0,
			currentContextTokens: tokens ?? 0,
			autoSummarize: autoSummarize ?? false,
			isContinueGenerationEnabled: isContinueGenerationEnabled ?? false,
		} satisfies ExtensionState
	}

	async setUseUdiff(value: boolean) {
		return this.globalStateManager.updateGlobalState("useUdiff", value)
	}

	async clearHistory() {
		await this.globalStateManager.updateGlobalState("taskHistory", [])
	}

	async setExperimentalTerminal(value: boolean) {
		this.context.getKoduDev()?.getStateManager()?.setExperimentalTerminal(value)
		return this.globalStateManager.updateGlobalState("experimentalTerminal", value)
	}

	async setAutoCloseTerminal(value: boolean) {
		this.context.getKoduDev()?.getStateManager()?.setAutoCloseTerminal(value)
		return this.globalStateManager.updateGlobalState("autoCloseTerminal", value)
	}

	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = (await this.globalStateManager.getGlobalState("taskHistory")) ?? []
		const existingItemIndex = history.findIndex((h) => h.id === item.id)
		if (existingItemIndex !== -1) {
			history[existingItemIndex] = {
				...history[existingItemIndex],
				...item,
			}
		} else {
			history.push(item)
		}
		await this.globalStateManager.updateGlobalState("taskHistory", history)
		return history
	}

	async clearTaskHistory() {
		await this.globalStateManager.updateGlobalState("taskHistory", [])
	}

	async fetchKoduUser() {
		const koduApiKey = await this.secretStateManager.getSecretState("koduApiKey")
		if (koduApiKey) {
			return await fetchKoduUserAPI({ apiKey: koduApiKey })
		}
		return null
	}

	async setSkipWriteAnimation(value: boolean) {
		this.context.getKoduDev()?.getStateManager()?.setSkipWriteAnimation(value)
		return this.globalStateManager.updateGlobalState("skipWriteAnimation", value)
	}
	async updateKoduCredits(credits: number) {
		const user = await this.globalStateManager.getGlobalState("user")
		if (user) {
			user.credits = credits
			await this.globalStateManager.updateGlobalState("user", user)
		}
	}

	setTechnicalBackground(value: "no-technical" | "technical" | "developer") {
		return this.globalStateManager.updateGlobalState("technicalBackground", value)
	}

	setMaxRequestsPerTask(value: number | undefined) {
		return this.globalStateManager.updateGlobalState("maxRequestsPerTask", value)
	}

	setCustomInstructions(value: string | undefined) {
		return this.globalStateManager.updateGlobalState("customInstructions", value)
	}

	setSystemPromptVariants(value: SystemPromptVariant[]) {
		return this.globalStateManager.updateGlobalState("systemPromptVariants", value)
	}
	setActiveSystemPromptVariantId(value: string | undefined) {
		return this.globalStateManager.updateGlobalState("activeSystemPromptVariantId", value)
	}

	setAutoSummarize(value: boolean) {
		return this.globalStateManager.updateGlobalState("autoSummarize", value)
	}

	setAlwaysAllowReadOnly(value: boolean) {
		return this.globalStateManager.updateGlobalState("alwaysAllowReadOnly", value)
	}

	setIsContinueGenerationEnabled(value: boolean) {
		return this.globalStateManager.updateGlobalState("isContinueGenerationEnabled", value)
	}

	setAlwaysAllowWriteOnly(value: boolean) {
		return this.globalStateManager.updateGlobalState("alwaysAllowWriteOnly", value)
	}

	setCreativeMode(value: "creative" | "normal" | "deterministic") {
		return this.globalStateManager.updateGlobalState("creativeMode", value)
	}
}
