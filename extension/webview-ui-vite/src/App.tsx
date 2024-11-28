import { useCallback, useMemo, useState } from "react"
import { useEvent } from "react-use"
import { ExtensionMessage } from "../../src/shared/ExtensionMessage"
import { ExtensionStateProvider, showSettingsAtom, useExtensionState } from "./context/ExtensionStateContext"
import { vscode } from "./utils/vscode"
import { normalizeApiConfiguration } from "./components/ApiOptions/utils"
import ChatView from "./components/chat-view/chat-view"
import HistoryView from "./components/HistoryView/HistoryView"
import "jotai-devtools/styles.css"
import "./App.css"
import EndOfTrialAlertDialog from "./components/EndOfTrialAlertDialog/end-of-trial-alert-dialog"
import { TooltipProvider } from "./components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import OnboardingDialog from "./components/onboarding"
import OutOfCreditDialog from "./components/dialogs/out-of-credit-dialog"
import SettingsPage from "./components/SettingsView/settings-tabs"
import { useAtom, useAtomValue } from "jotai"
import AnnouncementBanner from "./components/ announcement-banner"
const queryClient = new QueryClient()

const AppContent = () => {
	const { apiConfiguration, user, currentChatMode, chatHistory } = useExtensionState()
	const [showSettings, setShowSettings] = useAtom(showSettingsAtom)
	const [showHistory, setShowHistory] = useState(false)
	const [showChat, setShowChat] = useState(false)

	const handleChatModeChange = useCallback((mode: ChatMode) => {
		vscode.postMessage({
			type: 'action',
			action: 'switchChatMode',
			mode
		});
	}, []);

	const handleChatMessage = useCallback((content: string, images?: string[]) => {
		vscode.postMessage({
			type: 'action',
			action: 'chatMessage',
			text: content,
			images
		});
	}, []);

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
			{showHistory && <HistoryView onDone={() => setShowHistory(false)} />}
			{!isMaxContextReached && !showSettings && !showHistory && (
				<>
					<ChatMode
						mode={currentChatMode}
						messages={chatHistory || []}
						onSendMessage={handleChatMessage}
						onModeChange={handleChatModeChange}
					/>
					<ButtonSection
						primaryButtonText={state.primaryButtonText}
						secondaryButtonText={state.secondaryButtonText}
						enableButtons={state.enableButtons}
						isRequestRunning={isMessageRunning}
						handlePrimaryButtonClick={handlePrimaryButtonClick}
						handleSecondaryButtonClick={handleSecondaryButtonClick}
					/>
				</>
			)}
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
