import * as vscode from "vscode"
import { ApiModelId } from "../../../shared/api"
import { GlobalStateManager } from "./GlobalStateManager"
import { ApiManager } from "./ApiManager"
import { HistoryItem } from "../../../shared/HistoryItem"
import { SecretStateManager } from "./SecretStateManager"
import { fetchKoduUser as fetchKoduUserAPI } from "../../../api/kodu"
import { ExtensionProvider } from "../ClaudeCoderProvider"
import { ExtensionState } from "../../../shared/ExtensionMessage"
export class StateManager {
	private globalStateManager: GlobalStateManager
	private secretStateManager: SecretStateManager
	private apiManager: ApiManager

	constructor(private context: ExtensionProvider) {
		this.globalStateManager = new GlobalStateManager(context.context)
		this.apiManager = new ApiManager(context)
		this.secretStateManager = new SecretStateManager(context.context)
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
		])

		const currentTaskId = this.context.getKoduDev()?.getStateManager()?.state.taskId
		const currentClaudeMessage = this.context.getKoduDev()?.getStateManager()?.state.claudeMessages
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

	setAlwaysAllowReadOnly(value: boolean) {
		return this.globalStateManager.updateGlobalState("alwaysAllowReadOnly", value)
	}

	setAlwaysAllowWriteOnly(value: boolean) {
		return this.globalStateManager.updateGlobalState("alwaysAllowWriteOnly", value)
	}

	setCreativeMode(value: "creative" | "normal" | "deterministic") {
		return this.globalStateManager.updateGlobalState("creativeMode", value)
	}
}
