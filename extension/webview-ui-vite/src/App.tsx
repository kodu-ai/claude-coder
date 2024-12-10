import { useCallback, useMemo, useState } from "react"
import { useEvent } from "react-use"
import { ExtensionMessage } from "../../src/shared/extension-message"
import { ExtensionStateProvider, showSettingsAtom, useExtensionState } from "./context/extension-state-context"
import { vscode } from "./utils/vscode"
import { normalizeApiConfiguration } from "./components/settings-view/utils"
import ChatView from "./components/chat-view/chat-view"
import HistoryView from "./components/history-view/history-view"
import "./App.css"
import { TooltipProvider } from "./components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import OutOfCreditDialog from "./components/dialogs/out-of-credit-dialog"
import SettingsPage from "./components/settings-view/settings-tabs"
import { useAtom, useAtomValue } from "jotai"
const queryClient = new QueryClient()

const AppContent = () => {
	const { apiConfiguration, user } = useExtensionState()
	const [showSettings, setShowSettings] = useAtom(showSettingsAtom)
	const [showHistory, setShowHistory] = useState(false)

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		switch (message.type) {
			case "state": {
				// don't update showAnnouncement to false if shouldShowAnnouncement is false
				break
			}
			case "action":
				switch (message.action!) {
					case "settingsButtonTapped":
						setShowSettings(true)
						setShowHistory(false)
						break
					case "historyButtonTapped":
						setShowSettings(false)
						setShowHistory(true)
						break
					case "chatButtonTapped":
						setShowSettings(false)
						setShowHistory(false)
						break
				}
				break
		}
		// (react-use takes care of not registering the same listener multiple times even if this callback is updated.)
	}, [])

	useEvent("message", handleMessage)

	const { selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	return (
		<>
			{showSettings && <SettingsPage />}
			{/* {showSettings && <SettingsView onDone={() => setShowSettings(false)} />} */}
			{showHistory && <HistoryView onDone={() => setShowHistory(false)} />}
			{/* Do not conditionally load ChatView, it's expensive and there's state we don't want to lose (user input, disableInput, askResponse promise, etc.) */}
			<ChatView
				showHistoryView={() => {
					setShowSettings(false)
					setShowHistory(true)
				}}
				isHidden={showSettings || showHistory}
				selectedModelSupportsImages={selectedModelInfo.supportsImages}
				selectedModelSupportsPromptCache={selectedModelInfo.supportsPromptCache}
			/>
		</>
	)
}

const App = () => {
	return (
		<>
			{/* <DevTools /> */}

			<ExtensionStateProvider>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider>
						<AppContent />
					</TooltipProvider>
				</QueryClientProvider>
				<OutOfCreditDialog />
				{/* </Popover> */}
			</ExtensionStateProvider>
		</>
	)
}

export default App
