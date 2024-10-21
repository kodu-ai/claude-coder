import { useCallback, useMemo, useState } from "react"
import { useEvent } from "react-use"
import { ExtensionMessage } from "../../src/shared/ExtensionMessage"
import { ExtensionStateProvider, useExtensionState } from "./context/ExtensionStateContext"
import { vscode } from "./utils/vscode"
import { normalizeApiConfiguration } from "./components/ApiOptions/utils"
import ChatView from "./components/ChatView/ChatView"
import HistoryView from "./components/HistoryView/HistoryView"
import "jotai-devtools/styles.css"
import "./App.css"
import EndOfTrialAlertDialog from "./components/EndOfTrialAlertDialog/end-of-trial-alert-dialog"
import { TooltipProvider } from "./components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import OnboardingDialog from "./components/onboarding"
import OutOfCreditDialog from "./components/dialogs/out-of-credit-dialog"
import SettingsPage from "./components/SettingsView/settings-tabs"
const queryClient = new QueryClient()

const AppContent = () => {
	const { apiConfiguration, user } = useExtensionState()
	const [showSettings, setShowSettings] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [showWelcome, setShowWelcome] = useState<boolean>(false)
	const [showAnnouncement, setShowAnnouncement] = useState(false)

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		switch (message.type) {
			case "state":
				const hasKey = !!message.state?.user
				setShowWelcome(!hasKey)
				// don't update showAnnouncement to false if shouldShowAnnouncement is false
				if (message.state!.shouldShowAnnouncement) {
					setShowAnnouncement(true)
				}
				break
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
					case "koduAuthenticated":
						console.log(`koduAuthenticated`)
						setShowWelcome(false)
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
				showAnnouncement={showAnnouncement}
				selectedModelSupportsImages={selectedModelInfo.supportsImages}
				selectedModelSupportsPromptCache={selectedModelInfo.supportsPromptCache}
				hideAnnouncement={() => {
					vscode.postMessage({ type: "didCloseAnnouncement" })
					setShowAnnouncement(false)
				}}
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
						<OnboardingDialog />
					</TooltipProvider>
				</QueryClientProvider>
				<OutOfCreditDialog />
				<EndOfTrialAlertDialog />
				{/* </Popover> */}
			</ExtensionStateProvider>
		</>
	)
}

export default App
