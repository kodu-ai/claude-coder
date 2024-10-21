import React, { useEffect, useRef } from "react"
import { useEvent } from "react-use"
import { atom, useAtom, useSetAtom } from "jotai"
import { ClaudeMessage, ExtensionMessage } from "../../../src/shared/ExtensionMessage"
import { vscode } from "../utils/vscode"
import { ApiConfiguration } from "../../../src/api/index"
import { HistoryItem } from "../../../src/shared/HistoryItem"
import type { GlobalState } from "../../../src/providers/claude-coder/state/GlobalStateManager"

// Define atoms for each piece of state
const technicalBackgroundAtom = atom<GlobalState["technicalBackground"] | undefined>(undefined)
technicalBackgroundAtom.debugLabel = "technicalBackground"
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

const currentTaskAtom = atom<HistoryItem | undefined>((get) => {
	const currentTaskId = get(currentTaskIdAtom)
	return get(taskHistoryAtom).find((task) => task.id === currentTaskId)
})

// Derived atom for the entire state
export const extensionStateAtom = atom((get) => ({
	version: get(versionAtom),
	claudeMessages: get(claudeMessagesAtom),
	taskHistory: get(taskHistoryAtom),
	useUdiff: get(useUdiffAtom),
	currentTask: get(currentTaskAtom),
	currentTaskId: get(currentTaskIdAtom),
	shouldShowAnnouncement: get(shouldShowAnnouncementAtom),
	shouldShowKoduPromo: get(shouldShowKoduPromoAtom),
	apiConfiguration: get(apiConfigurationAtom),
	uriScheme: get(uriSchemeAtom),
	maxRequestsPerTask: get(maxRequestsPerTaskAtom),
	customInstructions: get(customInstructionsAtom),
	fingerprint: get(fingerprintAtom),
	technicalBackground: get(technicalBackgroundAtom),
	alwaysAllowReadOnly: get(alwaysAllowReadOnlyAtom),
	autoCloseTerminal: get(autoCloseTerminalAtom),
	fpjsKey: get(fpjsKeyAtom),
	extensionName: get(extensionNameAtom),
	themeName: get(themeNameAtom),
	user: get(userAtom),
	alwaysAllowWriteOnly: get(alwaysAllowApproveOnlyAtom),
	creativeMode: get(creativeModeAtom),
}))
extensionStateAtom.debugLabel = "extensionState"

// Atom to track if state has been hydrated
const didHydrateStateAtom = atom(false)
didHydrateStateAtom.debugLabel = "didHydrateState"

export const ExtensionStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const setVersion = useSetAtom(versionAtom)
	const setClaudeMessages = useSetAtom(claudeMessagesAtom)
	const setTaskHistory = useSetAtom(taskHistoryAtom)
	const setShouldShowAnnouncement = useSetAtom(shouldShowAnnouncementAtom)
	const setShouldShowKoduPromo = useSetAtom(shouldShowKoduPromoAtom)
	const setApiConfiguration = useSetAtom(apiConfigurationAtom)
	const setMaxRequestsPerTask = useSetAtom(maxRequestsPerTaskAtom)
	const setCustomInstructions = useSetAtom(customInstructionsAtom)
	const setAlwaysAllowReadOnly = useSetAtom(alwaysAllowReadOnlyAtom)
	const setUser = useSetAtom(userAtom)
	const setUseUdiff = useSetAtom(useUdiffAtom)
	const setThemeName = useSetAtom(themeNameAtom)
	const setCurrentIdTask = useSetAtom(currentTaskIdAtom)
	const setTechnicalBackground = useSetAtom(technicalBackgroundAtom)
	const setFingerprint = useSetAtom(fingerprintAtom)
	const setAutoCloseTerminal = useSetAtom(autoCloseTerminalAtom)
	const setUriScheme = useSetAtom(uriSchemeAtom)
	const setDidHydrateState = useSetAtom(didHydrateStateAtom)
	const setAlwaysAllowWriteOnly = useSetAtom(alwaysAllowApproveOnlyAtom)
	const setCreativeMode = useSetAtom(creativeModeAtom)
	const setExtensionName = useSetAtom(extensionNameAtom)
	const setFpjsKey = useSetAtom(fpjsKeyAtom)

	const handleMessage = (event: MessageEvent) => {
		const message: ExtensionMessage = event.data
		if (message.type === "claudeMessages") {
			setClaudeMessages(message.claudeMessages)
		}
		if (message.type === "state" && message.state) {
			setVersion(message.state.version)
			setCurrentIdTask(message.state.currentTaskId)
			setClaudeMessages(message.state.claudeMessages)
			setTechnicalBackground(message.state.technicalBackground)
			setTaskHistory(message.state.taskHistory)
			setShouldShowAnnouncement(message.state.shouldShowAnnouncement)
			setShouldShowKoduPromo(message.state.shouldShowKoduPromo)
			setApiConfiguration(message.state.apiConfiguration)
			setMaxRequestsPerTask(message.state.maxRequestsPerTask)
			setCustomInstructions(message.state.customInstructions)
			setAlwaysAllowReadOnly(!!message.state.alwaysAllowReadOnly)
			setAutoCloseTerminal(!!message.state.autoCloseTerminal)
			setUser(message.state.user)
			setExtensionName(message.state.extensionName)
			setAlwaysAllowWriteOnly(!!message.state.alwaysAllowWriteOnly)
			setDidHydrateState(true)
			setUseUdiff(!!message.state.useUdiff)
			setThemeName(message.state.themeName)
			setFpjsKey(message.state.fpjsKey)
			setFingerprint(message.state.fingerprint)
			setUriScheme(message.state.uriScheme)
			setCreativeMode(message.state.creativeMode ?? "normal")
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
	const setAlwaysAllowReadOnly = useSetAtom(alwaysAllowReadOnlyAtom)
	const setAlwaysAllowWriteOnly = useSetAtom(alwaysAllowApproveOnlyAtom)
	const setShouldShowAnnouncement = useSetAtom(shouldShowAnnouncementAtom)
	const setUseUdiff = useSetAtom(useUdiffAtom)
	const setAutoCloseTerminal = useSetAtom(autoCloseTerminalAtom)
	const setTechnicalBackground = useSetAtom(technicalBackgroundAtom)
	const setCreativeMode = useSetAtom(creativeModeAtom)

	return {
		...state,
		setApiConfiguration,
		setTechnicalBackground,
		setMaxRequestsPerTask,
		setUseUdiff,
		setAutoCloseTerminal,
		setCustomInstructions,
		setAlwaysAllowWriteOnly,
		setCreativeMode,
		setAlwaysAllowReadOnly,
		setShowAnnouncement: setShouldShowAnnouncement,
	}
}
