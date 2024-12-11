import { GlobalStateManager } from "./global-state-manager"
import { HistoryItem, isSatifiesHistoryItem } from "../../../shared/history-item"
import { SecretStateManager } from "./secret-state-manager"
import { fetchKoduUser as fetchKoduUserAPI } from "../../../api/kodu"
import { ExtensionProvider } from "../claude-coder-provider"
import { ExtensionState, isV1ClaudeMessage, V1ClaudeMessage } from "../../../shared/extension-message"

/**
 * this at the current form can't be a singleton because it has dependicies on the KoduDev instance, and one extension can have multiple KoduDev instances
 */
export class StateManager {
	private globalStateManager: GlobalStateManager
	private secretStateManager: SecretStateManager

	constructor(private context: ExtensionProvider) {
		this.globalStateManager = GlobalStateManager.getInstance(context.context)
		this.secretStateManager = SecretStateManager.getInstance(context.context)
	}

	async getState() {
		const [
			apiModelId,
			browserModelId,
			koduApiKey,
			user,
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			taskHistory,
			fp,
			autoCloseTerminal,
			skipWriteAnimation,
			autoSummarize,
			terminalCompressionThreshold,
			commandTimeout,
			gitHandlerEnabled,
			inlineEditOutputType,
		] = await Promise.all([
			this.globalStateManager.getGlobalState("apiModelId"),
			this.globalStateManager.getGlobalState("browserModelId"),
			this.secretStateManager.getSecretState("koduApiKey"),
			this.globalStateManager.getGlobalState("user"),
			this.globalStateManager.getGlobalState("lastShownAnnouncementId"),
			this.globalStateManager.getGlobalState("customInstructions"),
			this.globalStateManager.getGlobalState("alwaysAllowReadOnly"),
			this.globalStateManager.getGlobalState("alwaysAllowWriteOnly"),
			this.globalStateManager.getGlobalState("taskHistory"),
			this.secretStateManager.getSecretState("fp"),
			this.globalStateManager.getGlobalState("autoCloseTerminal"),
			this.globalStateManager.getGlobalState("skipWriteAnimation"),
			this.globalStateManager.getGlobalState("autoSummarize"),
			this.globalStateManager.getGlobalState("terminalCompressionThreshold"),
			this.globalStateManager.getGlobalState("commandTimeout"),
			this.globalStateManager.getGlobalState("gitHandlerEnabled"),
			this.globalStateManager.getGlobalState("inlineEditOutputType"),
		])

		const currentTaskId = this.context.getKoduDev()?.getStateManager()?.state.taskId
		const currentClaudeMessage = this.context.getKoduDev()?.getStateManager()?.state.claudeMessages

		const clone = currentClaudeMessage?.slice(-24).reverse()
		const lastClaudeApiFinished = clone?.find(
			(m) => isV1ClaudeMessage(m) && m.type === "say" && !!m.apiMetrics?.cost
		) as V1ClaudeMessage | undefined
		const tokens =
			(lastClaudeApiFinished?.apiMetrics?.inputTokens ?? 0) +
			(lastClaudeApiFinished?.apiMetrics?.outputTokens ?? 0) +
			(lastClaudeApiFinished?.apiMetrics?.inputCacheRead ?? 0) +
			(lastClaudeApiFinished?.apiMetrics?.inputCacheWrite ?? 0)
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
			terminalCompressionThreshold,
			lastShownAnnouncementId,
			customInstructions,
			commandTimeout: commandTimeout ?? 120,
			currentTaskId,
			alwaysAllowReadOnly:
				alwaysAllowReadOnly === undefined || alwaysAllowReadOnly === null ? true : alwaysAllowReadOnly,
			shouldShowAnnouncement: lastShownAnnouncementId === undefined,
			claudeMessages: currentClaudeMessage ?? [],
			version: this.context.context.extension.packageJSON.version,
			fpjsKey: process.env.FPJS_API_KEY,
			alwaysAllowWriteOnly: alwaysAllowWriteOnly ?? false,
			taskHistory: taskHistory ?? [],

			fingerprint: fp,
			autoCloseTerminal: autoCloseTerminal ?? false,
			skipWriteAnimation: skipWriteAnimation ?? false,
			currentContextWindow: currentContextWindow ?? 0,
			currentContextTokens: tokens ?? 0,
			autoSummarize: autoSummarize ?? false,
			inlineEditOutputType,
			gitHandlerEnabled: gitHandlerEnabled ?? true,
		} satisfies ExtensionState
	}

	async clearHistory() {
		await this.globalStateManager.updateGlobalState("taskHistory", [])
	}

	async setAutoCloseTerminal(value: boolean) {
		this.context.getKoduDev()?.getStateManager()?.setAutoCloseTerminal(value)
		return this.globalStateManager.updateGlobalState("autoCloseTerminal", value)
	}

	async setTerminalCompressionThreshold(value: number | undefined) {
		this.context.getKoduDev()?.getStateManager()?.setTerminalCompressionThreshold(value)
		return this.globalStateManager.updateGlobalState("terminalCompressionThreshold", value)
	}

	async setInlineEditModeType(value: "full" | "diff") {
		this.context.getKoduDev()?.getStateManager()?.setInlineEditOutputType(value)
		return this.globalStateManager.updateGlobalState("inlineEditOutputType", value)
	}

	async updateTaskHistory(item: Partial<HistoryItem> & { id: string }): Promise<HistoryItem[]> {
		const history = (await this.globalStateManager.getGlobalState("taskHistory")) ?? []
		const existingItemIndex = history.findIndex((h) => h.id === item.id)
		if (existingItemIndex !== -1) {
			history[existingItemIndex] = {
				...history[existingItemIndex],
				...item,
			}
		} else {
			if (isSatifiesHistoryItem(item)) {
				history.push(item)
			}
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

	setCustomInstructions(value: string | undefined) {
		return this.globalStateManager.updateGlobalState("customInstructions", value)
	}

	setAutoSummarize(value: boolean) {
		return this.globalStateManager.updateGlobalState("autoSummarize", value)
	}

	setGitHandlerEnabled(value: boolean) {
		return this.globalStateManager.updateGlobalState("gitHandlerEnabled", value)
	}

	setAlwaysAllowReadOnly(value: boolean) {
		return this.globalStateManager.updateGlobalState("alwaysAllowReadOnly", value)
	}

	setAlwaysAllowWriteOnly(value: boolean) {
		return this.globalStateManager.updateGlobalState("alwaysAllowWriteOnly", value)
	}
}
