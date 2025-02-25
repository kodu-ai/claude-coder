import * as vscode from "vscode"
import { ExtensionProvider } from "./providers/extension-provider"
import { amplitudeTracker } from "./utils/amplitude"
import * as dotenv from "dotenv"
import * as path from "path"
import { extensionName } from "./shared/constants"
import "./utils/path-helpers"
import {
	DIFF_VIEW_URI_SCHEME,
	INLINE_DIFF_VIEW_URI_SCHEME,
	INLINE_MODIFIED_URI_SCHEME,
	MODIFIED_URI_SCHEME,
} from "./integrations/editor/decoration-controller"
import { PromptStateManager } from "./providers/state/prompt-state-manager"
import DB from "./db"
import { TeachingBotHandler } from "./api/providers/teaching-bot"
import { TeachingBotMessageHandler } from "./api/providers/teaching-bot-handler"

/*
Built using https://github.com/microsoft/vscode-webview-ui-toolkit

Inspired by
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra

*/

let outputChannel: vscode.OutputChannel
var creditFetchInterval: NodeJS.Timeout | null | number = null
var lastFetchedAt = 0

async function updateUserCredit(provider?: ExtensionProvider) {
	const now = Date.now()
	if (now - lastFetchedAt < 5000) {
		return
	}
	lastFetchedAt = now
	const user = await provider?.getStateManager()?.fetchKoduUser()
	if (user) {
		provider?.getStateManager().updateKoduCredits(user.credits)
		provider?.getWebviewManager().postMessageToWebview({
			type: "action",
			action: "koduCreditsFetched",
			user,
		})
	}
}

async function startCreditFetch(provider: ExtensionProvider) {
	const now = Date.now()
	if (now - lastFetchedAt > 500) {
		await updateUserCredit(provider)
	}
	lastFetchedAt = now
	if (!creditFetchInterval) {
		creditFetchInterval = setInterval(() => {
			updateUserCredit(provider)
		}, 5050)
	}
}

function stopCreditFetch() {
	if (creditFetchInterval) {
		clearInterval(creditFetchInterval)
		creditFetchInterval = null
	}
}

function handleFirstInstall(context: vscode.ExtensionContext) {
	const isFirstInstall = context.globalState.get("isFirstInstall", true)
	console.log(`Extension is first install (isFirstInstall=${isFirstInstall})`)
	if (isFirstInstall) {
		context.globalState.update("isFirstInstall", false)
		amplitudeTracker.extensionActivateSuccess(!!isFirstInstall)
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	dotenv.config({ path: path.join(context.extensionPath, ".env") })
	console.log(`Current time of activation: ${new Date().toLocaleTimeString()}`)
	const getCurrentUser = () => {
		return context.globalState.get("user") as { email: string; credits: number; id: string } | undefined
	}

	// DB.init(path.join(context.globalStorageUri.fsPath, "db", "kodu.db"), context)

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	//console.log('Congratulations, your extension "Kodu" is now active!')
	outputChannel = vscode.window.createOutputChannel("Kodu")
	const user = getCurrentUser()
	const version = context.extension.packageJSON.version ?? "0.0.0"
	amplitudeTracker
		.initialize(context.globalState, !!user, vscode.env.sessionId, context.extension.id, version, user?.id)
		.then(() => {
			handleFirstInstall(context)
		})
	outputChannel.appendLine("Kodu extension activated")
	const sidebarProvider = new ExtensionProvider(context, outputChannel);

	// Initialize teaching bot
	let apiConfig;
	try {
		apiConfig = await sidebarProvider.getCurrentApiSettings();
	} catch (e: any) {
		console.error(e);
		apiConfig = {};
	}
	const mainChatbot = sidebarProvider.getApiManager();
	const teachingBot = new TeachingBotHandler(mainChatbot.options, mainChatbot);
	const teachingBotHandler = new TeachingBotMessageHandler(
		teachingBot,
		sidebarProvider.getWebviewManager(),
		mainChatbot
	);

	// Rejestracja handlera wiadomości od bota nauczającego
	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionName}.teachingBotMessage`, (message) => {
			teachingBotHandler.handleMessage(message)
		})
	)

	context.subscriptions.push(outputChannel)
	console.log(`Kodu extension activated`)

	// Register shadow billing commands
	const { registerToggleShadowBillingCommand } = require('./commands/toggle-shadow-billing')
	const { registerViewShadowBillingStatsCommand } = require('./commands/view-shadow-billing-stats')
	registerToggleShadowBillingCommand(context)
	registerViewShadowBillingStatsCommand(context)

	// Create status bar item for shadow billing
	const shadowBillingStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
	shadowBillingStatusBarItem.command = 'kodu.toggleShadowBilling'
	context.subscriptions.push(shadowBillingStatusBarItem)

	// Update status bar when shadow billing state changes
	const shadowBillingManager = require('./api/shadow-billing').ShadowBillingManager.getInstance()
	const { shadowBillingStateEmitter } = require('./commands/toggle-shadow-billing')
	
	const updateStatusBar = () => {
		if (shadowBillingManager.isShadowModeEnabled()) {
			shadowBillingStatusBarItem.text = "$(eye) Shadow Billing"
			shadowBillingStatusBarItem.tooltip = "Shadow Billing Mode Enabled - Click to disable"
			shadowBillingStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
			shadowBillingStatusBarItem.show()
		} else {
			shadowBillingStatusBarItem.text = "$(eye-closed) Normal Billing"
			shadowBillingStatusBarItem.tooltip = "Normal Billing Mode - Click to enable shadow billing"
			shadowBillingStatusBarItem.backgroundColor = undefined
			shadowBillingStatusBarItem.show()
		}
	}
	updateStatusBar() // Initial update

	// Listen for shadow billing state changes
	context.subscriptions.push(
		shadowBillingStateEmitter.event(() => {
			updateStatusBar()
		})
	)

	// Set up the window state change listener
	context.subscriptions.push(
		vscode.window.onDidChangeWindowState((windowState) => {
			if (windowState.focused) {
				startCreditFetch(sidebarProvider)
			} else {
				stopCreditFetch()
			}
		})
	)

	// Start fetching if the window is already focused when the extension activates
	if (vscode.window.state.focused) {
		startCreditFetch(sidebarProvider)
	}

	// Make sure to stop fetching when the extension is deactivated
	context.subscriptions.push({ dispose: stopCreditFetch })

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ExtensionProvider.sideBarId, sidebarProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		})
	)

	// Add new command for setting API key
	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionName}.setApiKey`, async () => {
			const apiKey = await vscode.window.showInputBox({
				prompt: "Enter your Kodu API Key",
				placeHolder: "API Key",
				password: true, // Masks the input
				ignoreFocusOut: true, // Keeps input box open when focus is lost
			})

			if (apiKey) {
				// Show progress indicator
				await vscode.window
					.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: "Verifying API Key",
							cancellable: false,
						},
						async (progress) => {
							try {
								progress.report({ increment: 0, message: "Saving API key..." })
								await sidebarProvider.getApiManager().saveKoduApiKey(apiKey)

								progress.report({ increment: 50, message: "Verifying credentials..." })
								// Attempt to verify the API key by fetching user data
								const user = await sidebarProvider.getStateManager().fetchKoduUser()

								if (user) {
									progress.report({ increment: 50, message: "Authentication successful!" })

									// Wait a moment for the success message to be visible
									await new Promise((resolve) => setTimeout(resolve, 500))

									vscode.window.showInformationMessage(`Successfully signed in as ${user.email}`)
									amplitudeTracker.authSuccess()

									// Update credits and UI
									sidebarProvider.getStateManager().updateKoduCredits(user.credits)
									sidebarProvider.getWebviewManager().postMessageToWebview({
										type: "action",
										action: "koduCreditsFetched",
										user,
									})

									// Focus the sidebar
									await vscode.commands.executeCommand(`${extensionName}.SidebarProvider.focus`)
								} else {
									throw new Error("Invalid API key")
								}
							} catch (error) {
								console.error("Error setting API key:", error)
								throw error // Re-throw to show error message after progress closes
							}
						}
					)
					.then(null, (error) => {
						// Handle any errors that occurred during the progress window
						vscode.window.showErrorMessage(
							error.message === "Invalid API key"
								? "Invalid API key. Please check and try again."
								: "Failed to set API key. Please try again."
						)
					})
			}
		})
	)

	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionName}.plusButtonTapped`, async () => {
			outputChannel.appendLine("Plus button tapped")
			await sidebarProvider?.getTaskManager().clearTask()
			await sidebarProvider?.getWebviewManager().postBaseStateToWebview()
			await sidebarProvider?.getWebviewManager().postClaudeMessagesToWebview([])
			await sidebarProvider
				?.getWebviewManager()
				.postMessageToWebview({ type: "action", action: "chatButtonTapped" })
		})
	)

	const openExtensionInNewTab = async () => {
		outputChannel.appendLine("Opening Kodu in new tab")
		// (this example uses webviewProvider activation event which is necessary to deserialize cached webview, but since we use retainContextWhenHidden, we don't need to use that event)
		// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
		const tabProvider = new ExtensionProvider(context, outputChannel)
		//const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined
		const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))
		const targetCol = Math.max(lastCol + 1, 1)
		const panel = vscode.window.createWebviewPanel(ExtensionProvider.tabPanelId, "Kodu", targetCol, {
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [context.extensionUri],
		})
		// Check if there are any visible text editors, otherwise open a new group to the right
		const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0
		if (!hasVisibleEditors) {
			await vscode.commands.executeCommand("workbench.action.newGroupRight")
		}
		// TODO: use better svg icon with light and dark variants (see https://stackoverflow.com/questions/58365687/vscode-extension-iconpath)
		panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "assets/icon.png")
		tabProvider.resolveWebviewView(panel)
		console.log("Opened Kodu in new tab")

		// Lock the editor group so clicking on files doesn't open over the panel
		new Promise((resolve) => setTimeout(resolve, 100)).then(() => {
			vscode.commands.executeCommand("workbench.action.lockEditorGroup")
		})
	}
	PromptStateManager.init(context)

	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionName}.popoutButtonTapped`, openExtensionInNewTab)
	)
	context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.openInNewTab`, openExtensionInNewTab))

	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionName}.newFeature`, () => {
			outputChannel.appendLine("New feature button tapped!")
		})
	)

	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionName}.settingsButtonTapped`, () => {
			//const message = "kodu-claude-coder-main.settingsButtonTapped!"
			//vscode.window.showInformationMessage(message)
			sidebarProvider
				?.getWebviewManager()
				?.postMessageToWebview({ type: "action", action: "settingsButtonTapped" })
		})
	)

	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionName}.historyButtonTapped`, () => {
			sidebarProvider
				?.getWebviewManager()
				?.postMessageToWebview({ type: "action", action: "historyButtonTapped" })
		})
	)

	/*
	We use the text document content provider API to show a diff view for new files/edits by creating a virtual document for the new content.

	- This API allows you to create readonly documents in VSCode from arbitrary sources, and works by claiming an uri-scheme for which your provider then returns text contents. The scheme must be provided when registering a provider and cannot change afterwards.
	- Note how the provider doesn't create uris for virtual documents - its role is to provide contents given such an uri. In return, content providers are wired into the open document logic so that providers are always considered.
	https://code.visualstudio.com/api/extension-guides/virtual-documents
	*/
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()

	const modifiedContentProvider = new (class implements vscode.TextDocumentContentProvider {
		private content = new Map<string, string>()

		provideTextDocumentContent(uri: vscode.Uri): string {
			return this.content.get(uri.toString()) || ""
		}

		// Method to update content
		updateContent(uri: vscode.Uri, content: string) {
			this.content.set(uri.toString(), content)
			this._onDidChange.fire(uri)
		}

		private _onDidChange = new vscode.EventEmitter<vscode.Uri>()
		onDidChange = this._onDidChange.event
	})()

	const inlineDiffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()

	const inlineModifiedContentProvider = new (class implements vscode.TextDocumentContentProvider {
		private content = new Map<string, string>()

		provideTextDocumentContent(uri: vscode.Uri): string {
			return this.content.get(uri.toString()) || ""
		}

		// Method to update content
		updateContent(uri: vscode.Uri, content: string) {
			this.content.set(uri.toString(), content)
			this._onDidChange.fire(uri)
		}

		private _onDidChange = new vscode.EventEmitter<vscode.Uri>()
		onDidChange = this._onDidChange.event
	})()
	vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
		vscode.workspace.registerTextDocumentContentProvider(MODIFIED_URI_SCHEME, modifiedContentProvider)
	vscode.workspace.registerTextDocumentContentProvider(INLINE_DIFF_VIEW_URI_SCHEME, inlineDiffContentProvider),
		vscode.workspace.registerTextDocumentContentProvider(INLINE_MODIFIED_URI_SCHEME, inlineModifiedContentProvider)
	// URI Handler
	const handleUri = async (uri: vscode.Uri) => {
		const query = new URLSearchParams(uri.query.replace(/\+/g, "%2B"))
		const token = query.get("token")
		const postTrial = query.get("postTrial")
		const email = query.get("email")
		// toast login success
		vscode.window.showInformationMessage(`Logged in as ${email} successfully!`)
		if (token) {
			amplitudeTracker.authSuccess()
			console.log(`Received token: ${token}`)
			if (postTrial) {
				amplitudeTracker.trialUpsellSuccess()
			}
			await vscode.commands.executeCommand(`${extensionName}.SidebarProvider.focus`)
			await sidebarProvider.getApiManager().saveKoduApiKey(token)
		}
	}

	context.subscriptions.push(
		vscode.window.registerUriHandler({
			async handleUri(uri: vscode.Uri) {
				console.log(`Received URI: ${uri.toString()}`)
				if (uri.path === `/${extensionName}.plusButtonTapped`) {
					await vscode.commands.executeCommand(`${extensionName}.SidebarProvider.focus`)
				} else {
					handleUri(uri)
				}
			},
		})
	)
}

// This method is called when your extension is deactivated
export function deactivate() {
	DB.disconnect()
	outputChannel.appendLine("Kodu extension deactivated")
}
