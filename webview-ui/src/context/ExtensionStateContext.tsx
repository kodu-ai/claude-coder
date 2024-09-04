import React, { useEffect } from "react"
import { useEvent } from "react-use"
import { atom, useAtom, useSetAtom } from "jotai"
import { ClaudeMessage, ExtensionMessage } from "../../../src/shared/ExtensionMessage"
import { vscode } from "../utils/vscode"
import { ApiConfiguration } from "../../../src/api/index"
import { HistoryItem } from "../../../src/shared/HistoryItem"

// Define atoms for each piece of state
const versionAtom = atom("")
const claudeMessagesAtom = atom<ClaudeMessage[]>([])
const taskHistoryAtom = atom<HistoryItem[]>([])
const shouldShowAnnouncementAtom = atom(false)
const shouldShowKoduPromoAtom = atom(false)
const apiConfigurationAtom = atom<ApiConfiguration | undefined>(undefined)
const maxRequestsPerTaskAtom = atom<number | undefined>(undefined)
const customInstructionsAtom = atom<string | undefined>(undefined)
const alwaysAllowReadOnlyAtom = atom(false)
const alwaysAllowApproveOnlyAtom = atom(false)
const userAtom = atom<{ credits: number; email: string; refCode?: string } | undefined>(undefined)
const uriSchemeAtom = atom<string | undefined>(undefined)
const themeNameAtom = atom<string | undefined>(undefined)
export const creativeModeAtom = atom<"creative" | "normal" | "deterministic">("normal")

// Derived atom for the entire state
const extensionStateAtom = atom((get) => ({
	version: get(versionAtom),
	claudeMessages: get(claudeMessagesAtom),
	taskHistory: get(taskHistoryAtom),
	shouldShowAnnouncement: get(shouldShowAnnouncementAtom),
	shouldShowKoduPromo: get(shouldShowKoduPromoAtom),
	apiConfiguration: get(apiConfigurationAtom),
	uriScheme: get(uriSchemeAtom),
	maxRequestsPerTask: get(maxRequestsPerTaskAtom),
	customInstructions: get(customInstructionsAtom),
	alwaysAllowReadOnly: get(alwaysAllowReadOnlyAtom),
	themeName: get(themeNameAtom),
	user: get(userAtom),
	alwaysAllowWriteOnly: get(alwaysAllowApproveOnlyAtom),
	creativeMode: get(creativeModeAtom),
}))

// Atom to track if state has been hydrated
const didHydrateStateAtom = atom(false)

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
	const setThemeName = useSetAtom(themeNameAtom)
	const setUriScheme = useSetAtom(uriSchemeAtom)
	const setDidHydrateState = useSetAtom(didHydrateStateAtom)
	const setAlwaysAllowWriteOnly = useSetAtom(alwaysAllowApproveOnlyAtom)
	const setCreativeMode = useSetAtom(creativeModeAtom)

	const handleMessage = (event: MessageEvent) => {
		const message: ExtensionMessage = event.data
		console.log("message at extenstion state context", event)
		if (message.type === "state" && message.state) {
			setVersion(message.state.version)
			setClaudeMessages(message.state.claudeMessages)
			setTaskHistory(message.state.taskHistory)
			setShouldShowAnnouncement(message.state.shouldShowAnnouncement)
			setShouldShowKoduPromo(message.state.shouldShowKoduPromo)
			setApiConfiguration(message.state.apiConfiguration)
			setMaxRequestsPerTask(message.state.maxRequestsPerTask)
			setCustomInstructions(message.state.customInstructions)
			setAlwaysAllowReadOnly(!!message.state.alwaysAllowReadOnly)
			setUser(message.state.user)
			setAlwaysAllowWriteOnly(!!message.state.alwaysAllowWriteOnly)
			setDidHydrateState(true)
			setThemeName(message.state.themeName)
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
	const setCreativeMode = useSetAtom(creativeModeAtom)

	return {
		...state,
		setApiConfiguration,
		setMaxRequestsPerTask,
		setCustomInstructions,
		setAlwaysAllowWriteOnly,
		setCreativeMode,
		setAlwaysAllowReadOnly,
		setShowAnnouncement: setShouldShowAnnouncement,
	}
}
