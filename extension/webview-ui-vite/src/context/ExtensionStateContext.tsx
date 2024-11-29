import { atom, useAtom, useSetAtom } from "jotai"
import React, { useEffect } from "react"
import { useEvent } from "react-use"
import { ApiConfiguration } from "../../../src/api/index"
import type { GlobalState } from "../../../src/providers/claude-coder/state/GlobalStateManager"
import { ClaudeMessage, ExtensionMessage } from "../../../src/shared/ExtensionMessage"
import { HistoryItem } from "../../../src/shared/HistoryItem"
import { SystemPromptVariant } from "../../../src/shared/SystemPromptVariant"
import { vscode } from "../utils/vscode"

// Define atoms for each piece of state
const technicalBackgroundAtom = atom<GlobalState["technicalBackground"] | undefined>(undefined)
technicalBackgroundAtom.debugLabel = "technicalBackground"

const inlineEditModeAtom = atom(false)
inlineEditModeAtom.debugLabel = "inlineEditMode"
const advanceThinkingModeAtom = atom(false)
advanceThinkingModeAtom.debugLabel = "advanceThinkingMode"

const commandTimeoutAtom = atom<number | undefined>(undefined)
commandTimeoutAtom.debugLabel = "commandTimeout"

const versionAtom = atom("")
versionAtom.debugLabel = "version"
const claudeMessagesAtom = atom<ClaudeMessage[]>([])
claudeMessagesAtom.debugLabel = "claudeMessages"
const taskHistoryAtom = atom<HistoryItem[]>([])
taskHistoryAtom.debugLabel = "taskHistory"
export const shouldShowAnnouncementAtom = atom(false)
shouldShowAnnouncementAtom.debugLabel = "shouldShowAnnouncement"
const shouldShowKoduPromoAtom = atom(false)
shouldShowKoduPromoAtom.debugLabel = "shouldShowKoduPromo"
const apiConfigurationAtom = atom<ApiConfiguration | undefined>(undefined)
apiConfigurationAtom.debugLabel = "apiConfiguration"
const maxRequestsPerTaskAtom = atom<number | undefined>(undefined)
maxRequestsPerTaskAtom.debugLabel = "maxRequestsPerTask"
const customInstructionsAtom = atom<string | undefined>(undefined)
customInstructionsAtom.debugLabel = "customInstructions"
const alwaysAllowReadOnlyAtom = atom(false)
alwaysAllowReadOnlyAtom.debugLabel = "alwaysAllowReadOnly"
const alwaysAllowApproveOnlyAtom = atom(false)
alwaysAllowApproveOnlyAtom.debugLabel = "alwaysAllowApproveOnly"
const userAtom = atom<GlobalState["user"]>(undefined)
userAtom.debugLabel = "user"
const uriSchemeAtom = atom<string | undefined>(undefined)
uriSchemeAtom.debugLabel = "uriScheme"
const themeNameAtom = atom<string | undefined>(undefined)
themeNameAtom.debugLabel = "themeName"
export const creativeModeAtom = atom<"creative" | "normal" | "deterministic">("normal")
creativeModeAtom.debugLabel = "creativeMode"
const extensionNameAtom = atom<string | undefined>(undefined)
extensionNameAtom.debugLabel = "extensionName"

const fingerprintAtom = atom<string | undefined>(undefined)
fingerprintAtom.debugLabel = "fingerprint"

const fpjsKeyAtom = atom<string | undefined>(undefined)
fpjsKeyAtom.debugLabel = "fpjsKey"

const currentTaskIdAtom = atom<string | undefined>(undefined)
currentTaskIdAtom.debugLabel = "currentTask"

const autoCloseTerminalAtom = atom(false)
autoCloseTerminalAtom.debugLabel = "autoCloseTerminal"

const useUdiffAtom = atom(false)
useUdiffAtom.debugLabel = "useUdiff"

const skipWriteAnimationAtom = atom(false)
skipWriteAnimationAtom.debugLabel = "skipWriteAnimation"

const systemPromptVariantsAtom = atom<SystemPromptVariant[]>([])
systemPromptVariantsAtom.debugLabel = "systemPromptVariants"

const activeSystemPromptVariantIdAtom = atom<string | undefined>(undefined)
activeSystemPromptVariantIdAtom.debugLabel = "activeSystemPromptVariantId"

const lastShownAnnouncementIdAtom = atom<string | undefined>(undefined)
lastShownAnnouncementIdAtom.debugLabel = "lastShownAnnouncementId"

const isContinueGenerationEnabledAtom = atom(false)
isContinueGenerationEnabledAtom.debugLabel = "isContinueGenerationEnabled"

const inlineEditModeTypeAtom = atom<"full" | "diff" | "none">("full")
inlineEditModeTypeAtom.debugLabel = "inlineEditModeType"

const currentTaskAtom = atom<HistoryItem | undefined>((get) => {
	const currentTaskId = get(currentTaskIdAtom)
	return get(taskHistoryAtom).find((task) => task.id === currentTaskId)
})

// Derived atom for the entire state
export const extensionStateAtom = atom((get) => ({
	version: get(versionAtom),
	commandTimeout: get(commandTimeoutAtom),
	terminalCompressionThreshold: get(terminalCompressionThresholdAtom),
	claudeMessages: get(claudeMessagesAtom),
	lastShownAnnouncementId: get(lastShownAnnouncementIdAtom),
	taskHistory: get(taskHistoryAtom),
	isContinueGenerationEnabled: get(isContinueGenerationEnabledAtom),
	currentContextWindow: get(currentContextWindowAtom),
	useUdiff: get(useUdiffAtom),
	autoSummarize: get(autoSummarizeAtom),
	currentContextTokens: get(currentContextTokensAtom),
	currentTask: get(currentTaskAtom),
	currentTaskId: get(currentTaskIdAtom),
	inlineEditModeAtom: get(inlineEditModeAtom),
	inlineEditModeType: get(inlineEditModeTypeAtom),
	shouldShowAnnouncement: get(shouldShowAnnouncementAtom),
	shouldShowKoduPromo: get(shouldShowKoduPromoAtom),
	apiConfiguration: get(apiConfigurationAtom),
	inlineEditMode: get(inlineEditModeAtom),
	advanceThinkingMode: get(advanceThinkingModeAtom),
	uriScheme: get(uriSchemeAtom),
	maxRequestsPerTask: get(maxRequestsPerTaskAtom),
	customInstructions: get(customInstructionsAtom),
	fingerprint: get(fingerprintAtom),
	skipWriteAnimation: get(skipWriteAnimationAtom),
	technicalBackground: get(technicalBackgroundAtom),
	alwaysAllowReadOnly: get(alwaysAllowReadOnlyAtom),
	activeSystemPromptVariantId: get(activeSystemPromptVariantIdAtom),
	autoCloseTerminal: get(autoCloseTerminalAtom),
	fpjsKey: get(fpjsKeyAtom),
	extensionName: get(extensionNameAtom),
	themeName: get(themeNameAtom),
	user: get(userAtom),
	alwaysAllowWriteOnly: get(alwaysAllowApproveOnlyAtom),
	creativeMode: get(creativeModeAtom),
	systemPromptVariants: get(systemPromptVariantsAtom),
}))
extensionStateAtom.debugLabel = "extensionState"

// Atom to track if state has been hydrated
const didHydrateStateAtom = atom(false)
didHydrateStateAtom.debugLabel = "didHydrateState"

export const showSettingsAtom = atom(false)
showSettingsAtom.debugLabel = "showSettings"

const currentContextTokensAtom = atom(0)
currentContextTokensAtom.debugLabel = "currentContextTokens"

const currentContextWindowAtom = atom(0)
currentContextWindowAtom.debugLabel = "currentContextWindow"

const autoSummarizeAtom = atom(false)
autoSummarizeAtom.debugLabel = "autoSummarize"

const terminalCompressionThresholdAtom = atom<number | undefined>(undefined)
terminalCompressionThresholdAtom.debugLabel = "terminalCompressionThreshold"

export const ExtensionStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const setVersion = useSetAtom(versionAtom)
	const setClaudeMessages = useSetAtom(claudeMessagesAtom)
	const setCommandTimeout = useSetAtom(commandTimeoutAtom)
	const setTaskHistory = useSetAtom(taskHistoryAtom)
	const setInlineEditMode = useSetAtom(inlineEditModeAtom)
	const setAdvanceThinkingMode = useSetAtom(advanceThinkingModeAtom)
	const setShouldShowAnnouncement = useSetAtom(shouldShowAnnouncementAtom)
	const setShouldShowKoduPromo = useSetAtom(shouldShowKoduPromoAtom)
	const setApiConfiguration = useSetAtom(apiConfigurationAtom)
	const setIsContinueGenerationEnabled = useSetAtom(isContinueGenerationEnabledAtom)
	const setMaxRequestsPerTask = useSetAtom(maxRequestsPerTaskAtom)
	const setCustomInstructions = useSetAtom(customInstructionsAtom)
	const setAlwaysAllowReadOnly = useSetAtom(alwaysAllowReadOnlyAtom)
	const setAutoSummarize = useSetAtom(autoSummarizeAtom)
	const setUser = useSetAtom(userAtom)
	const setLastShownAnnouncementId = useSetAtom(lastShownAnnouncementIdAtom)
	const setSkipWriteAnimation = useSetAtom(skipWriteAnimationAtom)
	const setUseUdiff = useSetAtom(useUdiffAtom)
	const setThemeName = useSetAtom(themeNameAtom)
	const setCurrentIdTask = useSetAtom(currentTaskIdAtom)
	const setTechnicalBackground = useSetAtom(technicalBackgroundAtom)
	const setActiveSystemPromptVariantId = useSetAtom(activeSystemPromptVariantIdAtom)
	const setFingerprint = useSetAtom(fingerprintAtom)
	const setAutoCloseTerminal = useSetAtom(autoCloseTerminalAtom)
	const setUriScheme = useSetAtom(uriSchemeAtom)
	const setCurrentContextWindow = useSetAtom(currentContextWindowAtom)
	const setDidHydrateState = useSetAtom(didHydrateStateAtom)
	const setCurrentContextTokens = useSetAtom(currentContextTokensAtom)
	const setAlwaysAllowWriteOnly = useSetAtom(alwaysAllowApproveOnlyAtom)
	const setCreativeMode = useSetAtom(creativeModeAtom)
	const setExtensionName = useSetAtom(extensionNameAtom)
	const setFpjsKey = useSetAtom(fpjsKeyAtom)
	const setSystemPromptVariants = useSetAtom(systemPromptVariantsAtom)
	const setTerminalCompressionThreshold = useSetAtom(terminalCompressionThresholdAtom)
	const setInlineEditModeType = useSetAtom(inlineEditModeTypeAtom)

	const handleMessage = (event: MessageEvent) => {
		const message: ExtensionMessage = event.data
		if (message.type === "putClaudeMessages") {
			console.debug(`[DEBUG]: Received ${message.claudeMessages.length} messages`)
			setClaudeMessages((prev) => [...prev, ...message.claudeMessages])
			return
		}
		if (message.type === "claudeMessages") {
			setClaudeMessages(message.claudeMessages)
		}

		if (message.type === "state" && message.state) {
			setVersion(message.state.version)
			setCurrentIdTask(message.state.currentTaskId)
			setCommandTimeout(message.state.commandTimeout)
			setTerminalCompressionThreshold(message.state.terminalCompressionThreshold)
			setClaudeMessages(message.state.claudeMessages)
			setTechnicalBackground(message.state.technicalBackground)
			setInlineEditMode(!!message.state.inlineEditMode)
			setAdvanceThinkingMode(!!message.state.advanceThinkingMode)
			setAutoSummarize(!!message.state.autoSummarize)
			setInlineEditModeType(message.state.inlineEditOutputType ?? "full")
			setLastShownAnnouncementId(message.state.lastShownAnnouncementId)
			setTaskHistory(message.state.taskHistory)
			setShouldShowAnnouncement(message.state.shouldShowAnnouncement)
			setShouldShowKoduPromo(message.state.shouldShowKoduPromo)
			setCurrentContextTokens(message.state.currentContextTokens)
			setIsContinueGenerationEnabled(!!message.state.isContinueGenerationEnabled)
			setApiConfiguration(message.state.apiConfiguration)
			setActiveSystemPromptVariantId(message.state.activeSystemPromptVariantId)
			setMaxRequestsPerTask(message.state.maxRequestsPerTask)
			setCustomInstructions(message.state.customInstructions)
			setAlwaysAllowReadOnly(!!message.state.alwaysAllowReadOnly)
			setCurrentContextWindow(message.state.currentContextWindow)
			setAutoCloseTerminal(!!message.state.autoCloseTerminal)
			setUser(message.state.user)
			setExtensionName(message.state.extensionName)
			setSkipWriteAnimation(!!message.state.skipWriteAnimation)
			setAlwaysAllowWriteOnly(!!message.state.alwaysAllowWriteOnly)
			setDidHydrateState(true)
			setUseUdiff(!!message.state.useUdiff)
			setThemeName(message.state.themeName)
			setFpjsKey(message.state.fpjsKey)
			setFingerprint(message.state.fingerprint)
			setUriScheme(message.state.uriScheme)
			setCreativeMode(message.state.creativeMode ?? "normal")
			setSystemPromptVariants(message.state.systemPromptVariants ?? [])
		}
		if (message.type === "action" && message.action === "koduCreditsFetched") {
			setUser(message.user)
		}
	}

	useEvent("message", handleMessage)

	useEffect(() => {
		vscode.postMessage({ type: "webviewDidLaunch" })
	}, [])

	const [didHydrateState] = useAtom(didHydrateStateAtom)

	if (!didHydrateState) {
		return null
	}

	return <>{children}</>
}

export const useExtensionState = () => {
	const [state] = useAtom(extensionStateAtom)
	const setApiConfiguration = useSetAtom(apiConfigurationAtom)
	const setMaxRequestsPerTask = useSetAtom(maxRequestsPerTaskAtom)
	const setCustomInstructions = useSetAtom(customInstructionsAtom)
	const setLastShownAnnouncementId = useSetAtom(lastShownAnnouncementIdAtom)
	const setTerminalCompressionThreshold = useSetAtom(terminalCompressionThresholdAtom)
	const setAlwaysAllowReadOnly = useSetAtom(alwaysAllowReadOnlyAtom)
	const setCommandTimeout = useSetAtom(commandTimeoutAtom)
	const setAlwaysAllowWriteOnly = useSetAtom(alwaysAllowApproveOnlyAtom)
	const setInlineEditModeType = useSetAtom(inlineEditModeTypeAtom)
	const setShouldShowAnnouncement = useSetAtom(shouldShowAnnouncementAtom)
	const setInlineEditMode = useSetAtom(inlineEditModeAtom)
	const setAdvanceThinkingMode = useSetAtom(advanceThinkingModeAtom)
	const setActiveSystemPromptVariantId = useSetAtom(activeSystemPromptVariantIdAtom)
	const setSkipWriteAnimation = useSetAtom(skipWriteAnimationAtom)
	const setUseUdiff = useSetAtom(useUdiffAtom)
	const setAutoSummarize = useSetAtom(autoSummarizeAtom)
	const setAutoCloseTerminal = useSetAtom(autoCloseTerminalAtom)
	const setTechnicalBackground = useSetAtom(technicalBackgroundAtom)
	const setCreativeMode = useSetAtom(creativeModeAtom)
	const setSystemPromptVariants = useSetAtom(systemPromptVariantsAtom)
	const setIsContinueGenerationEnabled = useSetAtom(isContinueGenerationEnabledAtom)
	return {
		...state,
		setApiConfiguration,
		setLastShownAnnouncementId,
		setTerminalCompressionThreshold,
		setTechnicalBackground,
		setMaxRequestsPerTask,
		setSkipWriteAnimation,
		setUseUdiff,
		setCommandTimeout,
		setIsContinueGenerationEnabled,
		setAutoCloseTerminal,
		setCustomInstructions,
		setAlwaysAllowWriteOnly,
		setInlineEditModeType,
		setCreativeMode,
		setAutoSummarize,
		setInlineEditMode,
		setAdvanceThinkingMode,
		setAlwaysAllowReadOnly,
		setActiveSystemPromptVariantId,
		setShowAnnouncement: setShouldShowAnnouncement,
		setSystemPromptVariants,
	}
}
