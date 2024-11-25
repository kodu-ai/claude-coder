import { readdir } from "fs/promises"
import path from "path"
import * as vscode from "vscode"
import { ExtensionMessage, ExtensionState } from "../../../shared/ExtensionMessage"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { getNonce, getUri } from "../../../utils"
import { AmplitudeWebviewManager } from "../../../utils/amplitude/manager"
import { ExtensionProvider } from "../ClaudeCoderProvider"
import { quickStart } from "./quick-start"
import { extensionName } from "../../../shared/Constants"
import { GlobalStateManager } from "../state/GlobalStateManager"

/**
 * Represents an item in the file tree structure.
 * Used to display and manage hierarchical file/folder organization in the webview.
 */
interface FileTreeItem {
	/** Unique identifier for the item */
	id: string
	/** Display name of the file or folder */
	name: string
	/** Child items for folders */
	children?: FileTreeItem[]
	/** Nesting level in the tree structure */
	depth: number
	/** Indicates whether this is a file or folder */
	type: "file" | "folder"
}

/**
 * Directories that should be excluded from the file tree
 * to avoid cluttering the view with non-essential files
 */
const excludedDirectories = [
	"node_modules",
	"venv",
	".venv",
	"__pycache__",
	".git",
	"dist",
	"build",
	"target",
	"vendor",
	"modules",
	"packages",
]

/**
 * Manages the webview interface for the Claude Coder extension.
 * Handles communication between the extension and webview, manages state updates,
 * and provides functionality for file system operations and user interactions.
 */
export class WebviewManager {
	/** ID of the latest announcement to show to users */
	private static readonly latestAnnouncementId = "sep-13-2024"
	private static readonly UPDATE_INTERVAL = 20 // 20ms debounce for webview updates
	private static readonly MAX_POST_INTERVAL = 60 // max time to wait before forcing a post

	private lastPostTimeAt = 0
	private debounceTimer: NodeJS.Timeout | null = null
	private maxIntervalTimer: NodeJS.Timeout | null = null
	private pendingMessage: ExtensionMessage | null = null

	/**
	 * Creates a new WebviewManager instance
	 * @param provider The extension provider that owns this webview manager
	 */
	constructor(private provider: ExtensionProvider) {}

	/**
	 * Initializes and configures a webview instance
	 * Sets up message listeners, HTML content, and visibility handlers
	 * @param webviewView The webview or webview panel to setup
	 */
	setupWebview(webviewView: vscode.WebviewView | vscode.WebviewPanel) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.provider.getContext().extensionUri],
		}
		webviewView.webview.html = this.getHtmlContent(webviewView.webview)

		this.setWebviewMessageListener(webviewView.webview)

		if ("onDidChangeViewState" in webviewView) {
			webviewView.onDidChangeViewState(
				() => {
					if (webviewView.visible) {
						this.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
					}
				},
				null,
				this.provider["disposables"]
			)
		} else if ("onDidChangeVisibility" in webviewView) {
			webviewView.onDidChangeVisibility(
				() => {
					if (webviewView.visible) {
						this.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
					}
				},
				null,
				this.provider["disposables"]
			)
		}
	}

	/**
	 * Shows an input box to collect user input
	 * @param options Configuration options for the input box
	 * @returns Promise that resolves to the user's input or undefined if cancelled
	 */
	async showInputBox(options: vscode.InputBoxOptions): Promise<string | undefined> {
		return vscode.window.showInputBox(options)
	}

	/**
	 * Posts a message to the webview with debouncing to prevent too frequent updates
	 * while ensuring messages are not delayed too long
	 * @param message The message to send to the webview
	 */
	async postMessageToWebview(message: ExtensionMessage) {
		if (
			message.type === "taskHistory" ||
			message.type === "requestStatus" ||
			message.type === "claudeMessages" ||
			message.type === "enableTextAreas"
		) {
			// prioritize these messages
			this.sendMessageToWebview(message)
			return
		}
		const now = Date.now()
		this.lastPostTimeAt = now
		this.pendingMessage = message

		// Clear existing timers
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
		}
		if (this.maxIntervalTimer) {
			clearTimeout(this.maxIntervalTimer)
		}

		// Set up max interval timer to ensure message is sent within MAX_POST_INTERVAL
		this.maxIntervalTimer = setTimeout(() => {
			if (this.pendingMessage) {
				this.sendMessageToWebview(this.pendingMessage)
				this.pendingMessage = null
				this.clearTimers()
			}
		}, WebviewManager.MAX_POST_INTERVAL)

		// Set up debounce timer
		this.debounceTimer = setTimeout(() => {
			if (this.pendingMessage) {
				this.sendMessageToWebview(this.pendingMessage)
				this.pendingMessage = null
				this.clearTimers()
			}
		}, WebviewManager.UPDATE_INTERVAL)
	}

	/**
	 * Actually sends the message to the webview
	 * @param message The message to send
	 */
	private sendMessageToWebview(message: ExtensionMessage) {
		console.log(`Posting message at ${Date.now()}`)
		this.provider["view"]?.webview.postMessage(message)
	}

	/**
	 * Cleans up any existing timers
	 */
	private clearTimers() {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}
		if (this.maxIntervalTimer) {
			clearTimeout(this.maxIntervalTimer)
			this.maxIntervalTimer = null
		}
	}
	/**
	 * only post claude messages to webview
	 */
	async postClaudeMessagesToWebview() {
		const claudeMessages = this.provider.getKoduDev()?.getStateManager().state.claudeMessages ?? []

		return this.postMessageToWebview({
			type: "claudeMessages",
			claudeMessages,
		})
	}

	async postStateToWebview() {
		const state = await this.getStateToPostToWebview()
		await this.postMessageToWebview({ type: "state", state })
	}

	private async getStateToPostToWebview() {
		const state = await this.provider.getStateManager().getState()
		const koduDevState = this.provider.getKoduDev()?.getStateManager().state
		const extensionName = this.provider.getContext().extension?.packageJSON?.name

		return {
			...state,
			version: this.provider.getContext().extension?.packageJSON?.version ?? "",
			themeName: vscode.workspace.getConfiguration("workbench").get<string>("colorTheme"),
			uriScheme: vscode.env.uriScheme,
			extensionName,
			claudeMessages: koduDevState?.claudeMessages ?? [],
			taskHistory: (state.taskHistory || []).filter((item) => item.ts && item.task).sort((a, b) => b.ts - a.ts),
			shouldShowAnnouncement: false,
		} satisfies ExtensionState
	}

	private getHtmlContent(webview: vscode.Webview): string {
		const localPort = "5173"
		const localServerUrl = `localhost:${localPort}`
		let scriptUri
		const isProd = this.provider.getContext().extensionMode === vscode.ExtensionMode.Production
		if (isProd) {
			scriptUri = getUri(webview, this.provider.getContext().extensionUri, [
				"webview-ui-vite",
				"build",
				"assets",
				"index.js",
			])
		} else {
			scriptUri = `http://${localServerUrl}/src/index.tsx`
		}
		const stylesUri = getUri(webview, this.provider.getContext().extensionUri, [
			"webview-ui-vite",
			"build",
			"assets",
			"index.css",
		])

		const codiconsUri = getUri(webview, this.provider.getContext().extensionUri, [
			"node_modules",
			"@vscode",
			"codicons",
			"dist",
			"codicon.css",
		])

		const nonce = getNonce()

		const csp = [
			`default-src 'none';`,
			`script-src 'unsafe-eval' https://* vscode-webview: ${
				isProd ? `'nonce-${nonce}'` : `http://${localServerUrl} http://0.0.0.0:${localPort} 'unsafe-inline'`
			}`,
			`style-src ${webview.cspSource} 'self' 'unsafe-inline' https://* vscode-webview:`,
			`font-src ${webview.cspSource} vscode-webview:`,
			`img-src ${webview.cspSource} data: vscode-webview:`,
			`connect-src https://* vscode-webview: ${
				isProd
					? ``
					: `ws://${localServerUrl} ws://0.0.0.0:${localPort} http://${localServerUrl} http://0.0.0.0:${localPort}`
			}`,
		]

		return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">
	        <link rel="stylesheet" type="text/css" href="${stylesUri}">
			<link href="${codiconsUri}" rel="stylesheet" />
            <title>Claude Coder</title>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            ${
				isProd
					? ""
					: `
                <script type="module">
                  import RefreshRuntime from "http://${localServerUrl}/@react-refresh"
                  RefreshRuntime.injectIntoGlobalHook(window)
                  window.$RefreshReg$ = () => {}
                  window.$RefreshSig$ = () => (type) => type
                  window.__vite_plugin_react_preamble_installed__ = true
                </script>
                `
			}
            <script type="module" src="${scriptUri}"></script>
          </body>
        </html>
      `
	}

	/**
	 * Recursively builds a tree structure of files and folders in a directory
	 * Excludes specified directories to keep the tree clean and relevant
	 * @param dir The directory path to scan
	 * @param parentId The ID of the parent node in the tree
	 * @returns Promise resolving to an array of FileTreeItems representing the directory structure
	 */
	async getFileTree(dir: string, parentId: string = ""): Promise<FileTreeItem[]> {
		const entries = await readdir(dir, { withFileTypes: true })
		const items: FileTreeItem[] = []

		for (const entry of entries) {
			if (excludedDirectories.includes(entry.name)) {
				continue
			}

			const id = parentId ? `${parentId}/${entry.name}` : entry.name
			const fullPath = path.join(dir, entry.name)

			if (entry.isDirectory()) {
				const children = await this.getFileTree(fullPath, id)
				items.push({
					id,
					depth: parentId.split("-").length,
					name: entry.name,
					children,
					type: "folder",
				})
			} else {
				items.push({
					id,
					depth: parentId.split("-").length,
					name: entry.name,
					type: "file",
				})
			}
		}

		return items
	}

	/**
	 * Sets up message handling for the webview
	 * Processes various message types from the webview and triggers appropriate actions
	 * @param webview The webview instance to attach the message listener to
	 */
	private setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			async (message: WebviewMessage) => {
				switch (message.type) {
					case "skipWriteAnimation":
						await this.provider.getStateManager().setSkipWriteAnimation(!!message.bool)
						await this.postStateToWebview()
						break
					case "updateGlobalState":
						for (const [key, value] of Object.entries(message.state)) {
							await this.provider
								.getGlobalStateManager()
								.updateGlobalState(key as keyof typeof message.state, value)
						}
						break
					case "toolFeedback":
						const feedbackMessage = message.feedbackMessage
						const feedback = message.feedback !== "approve" ? feedbackMessage : undefined
						const responseType =
							message.feedback === "approve"
								? "yesButtonTapped"
								: (feedback ?? "").length > 0
								? "messageResponse"
								: "noButtonTapped"
						await this.provider.getTaskManager().handleAskResponse(responseType, feedback)
						break
					case "technicalBackground":
						await this.provider.getStateManager().setTechnicalBackground(message.value)
						await this.postStateToWebview()
						break
					case "experimentalTerminal":
						await this.provider.getStateManager().setExperimentalTerminal(message.bool)
						await this.postStateToWebview()
						break
					case "clearHistory":
						await this.provider.getStateManager().clearHistory()
						await this.provider.getTaskManager().clearAllTasks()
						await this.postStateToWebview()
						break
					case "fileTree":
						const workspaceFolders = vscode.workspace.workspaceFolders
						if (workspaceFolders && workspaceFolders.length > 0) {
							const rootPath = workspaceFolders[0].uri.fsPath
							const fileTree = await this.getFileTree(rootPath)
							this.postMessageToWebview({
								type: "fileTree",
								tree: fileTree,
							})
						}
						break
					case "quickstart":
						console.log("Quickstart message received")
						this.provider.getTaskManager().handleNewTask
						const callback = async (description: string) => {
							// create new KoduDev instance with description as first message
							await this.provider.initWithTask(description, [])
						}
						await quickStart(message.repo, message.name, callback)
						break
					case "renameTask":
						await this.provider.getTaskManager().renameTask(
							message.isCurentTask
								? {
										isCurentTask: true,
								  }
								: {
										taskId: message.taskId!,
								  }
						)
						break
					case "useUdiff":
						await this.provider.getStateManager().setUseUdiff(message.bool)
						console.log(`useUdiff: ${message.bool}`)
						await this.postStateToWebview()
						break
					case "freeTrial":
						await this.provider.getApiManager().initFreeTrialUser(message.fp)
						break
					case "openExternalLink":
						vscode.env.openExternal(vscode.Uri.parse(message.url))
						break
					case "isContinueGenerationEnabled":
						await this.provider.getStateManager().setIsContinueGenerationEnabled(message.bool)
						await this.postStateToWebview()
						break
					case "amplitude":
						AmplitudeWebviewManager.handleMessage(message)
						break
					case "cancelCurrentRequest":
						await this.provider.getKoduDev()?.taskExecutor.abortTask()
						break
					case "autoSummarize":
						await this.provider.getStateManager().setAutoSummarize(message.bool)
						if (this.provider.koduDev) {
							this.provider.koduDev.getStateManager().setAutoSummarize(message.bool)
						}
						await this.postStateToWebview()
						break
					case "abortAutomode":
						await this.provider.getTaskManager().clearTask()
						await this.postStateToWebview()
						break
					case "webviewDidLaunch":
						await this.postStateToWebview()
						break
					case "newTask":
						await this.provider
							.getTaskManager()
							.handleNewTask(message.text, message.images, message.attachements)
						break
					case "apiConfiguration":
						if (message.apiConfiguration) {
							await this.provider.getApiManager().updateApiConfiguration(message.apiConfiguration)
							await this.postStateToWebview()
						}
						break
					case "activeSystemPromptVariant":
						await this.provider.getStateManager().setActiveSystemPromptVariantId(message.variantId)
						await this.postStateToWebview()
						break
					case "autoCloseTerminal":
						await this.provider.getStateManager().setAutoCloseTerminal(message.bool)
						await this.postStateToWebview()
						break
					case "systemPromptVariants":
						await this.provider.getStateManager().setSystemPromptVariants(message.variants)
						await this.postStateToWebview()
						break
					case "maxRequestsPerTask":
						await this.provider
							.getStateManager()
							.setMaxRequestsPerTask(message.text ? Number(message.text) : undefined)
						await this.postStateToWebview()
						break
					case "customInstructions":
						await this.provider.getStateManager().setCustomInstructions(message.text || undefined)
						await this.postStateToWebview()
						break
					case "alwaysAllowReadOnly":
						await this.provider.getStateManager().setAlwaysAllowReadOnly(message.bool ?? false)
						await this.postStateToWebview()
						break
					case "alwaysAllowWriteOnly":
						await this.provider.getStateManager().setAlwaysAllowWriteOnly(message.bool ?? false)
						await this.postStateToWebview()
						break
					case "askResponse":
						console.log("askResponse", message)
						await this.provider
							.getTaskManager()
							.handleAskResponse(message.askResponse!, message.text, message.images, message.attachements)
						break
					case "clearTask":
						await this.provider.getTaskManager().clearTask()
						await this.postStateToWebview()
						break
					case "setApiKeyDialog":
						// trigger vscode.commands.registerCommand(`${extensionName}.setApiKey`
						vscode.commands.executeCommand(`${extensionName}.setApiKey`)
						break
					case "switchAutomaticMode":
						await this.provider.getTaskManager().switchAutomaticMode()
						break
					case "pauseNext":
						await this.provider.getKoduDev()?.taskExecutor.pauseNextRequest()
						break
					case "didCloseAnnouncement":
						const packageJSON = this.provider.getContext().extension?.packageJSON
						await this.provider
							.getGlobalStateManager()
							.updateGlobalState("lastShownAnnouncementId", packageJSON?.version)
						await this.postStateToWebview()
						break
					case "setAdvanceThinkingMode":
						GlobalStateManager.getInstance().updateGlobalState("isAdvanceThinkingEnabled", message.bool)
						break
					case "setInlinedMode":
						GlobalStateManager.getInstance().updateGlobalState("isInlineEditingEnabled", message.bool)
						break
					case "selectImages":
						const images = await this.provider.getTaskManager().selectImages()
						await this.postMessageToWebview({
							type: "selectedImages",
							images: images.map((img) => img),
						})
						break
					case "exportCurrentTask":
						await this.provider.getTaskManager().exportCurrentTask()
						break
					case "showTaskWithId":
						await this.provider.getTaskManager().showTaskWithId(message.text!)
						break
					case "deleteTaskWithId":
						await this.provider.getTaskManager().deleteTaskWithId(message.text!)
						break
					case "setCreativeMode":
						await this.provider
							.getStateManager()
							.setCreativeMode(message.text as "creative" | "normal" | "deterministic")
						await this.postStateToWebview()
						break
					case "exportTaskWithId":
						await this.provider.getTaskManager().exportTaskWithId(message.text!)
						break
					case "didClickKoduSignOut":
						await this.provider.getApiManager().signOutKodu()
						await this.postStateToWebview()
						break
					case "fetchKoduCredits":
						await this.provider.getApiManager().fetchKoduCredits()
						await this.postMessageToWebview({
							type: "action",
							action: "koduCreditsFetched",
							state: await this.getStateToPostToWebview(),
						})
						break
					case "didDismissKoduPromo":
						await this.provider.getGlobalStateManager().updateGlobalState("shouldShowKoduPromo", false)
						await this.postStateToWebview()
						break
					case "resetState":
						await this.provider.getGlobalStateManager().resetState()
						await this.provider.getSecretStateManager().resetState()
						await this.postStateToWebview()
						break
					case "debug":
						await this.handleDebugInstruction()
						break
				}
			},
			null,
			this.provider["disposables"]
		)
	}

	/**
	 * Handles debug instructions for the extension
	 * Analyzes open tabs in the workspace and collects diagnostic information
	 * Creates a new task if needed and processes debugging information
	 * @returns Promise that resolves when debug handling is complete
	 */
	private async handleDebugInstruction(): Promise<void> {
		let agent = this.provider.getKoduDev()
		let noTask = false
		const openFolders = vscode.workspace.workspaceFolders
		if (!openFolders) {
			vscode.window.showErrorMessage("No open workspaces, please open a workspace.")
			return
		}

		if (openFolders.length > 1) {
			vscode.window.showErrorMessage("Multiple workspaces detected! Please open only one workspace.")
			return
		}

		if (!agent) {
			// create a new task
			await this.provider.initWithNoTask()
			agent = this.provider.getKoduDev()!
			noTask = true
		}
		vscode.window.showInformationMessage(
			"Debugging open tabs in workspace. if you want to debug a specific tab, please open it."
		)
		// now get diagnostics for all the open tabs
		const openTabs = vscode.window.visibleTextEditors
		for (const tab of openTabs) {
			agent.getStateManager().addErrorPath(tab.document.uri.fsPath)
		}

		const problemsString = "Check system logs for more information."
		if (noTask) {
			const task = `I am working on debugging issues related to the open tabs in my workspace. I've attached the diagnostics for the open tabs. Please provide a step-by-step approach to analyze and resolve any potential issues or inefficiencies based on the provided information. Focus on clarity and actionable steps, and suggest best practices where applicable.`

			await agent.startTask(task)
			return
		}
		// flag this is legacy it should actually be handled by the task executor
		return await agent.handleWebviewAskResponse("messageResponse", problemsString)
	}
	/**
	 * Cleanup method to be called when the webview manager is disposed
	 */
	dispose() {
		this.clearTimers()
	}
}
