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

interface FileTreeItem {
	id: string
	name: string
	children?: FileTreeItem[]
	depth: number
	type: "file" | "folder"
}

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

export class WebviewManager {
	private static readonly latestAnnouncementId = "sep-13-2024"

	constructor(private provider: ExtensionProvider) {}

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

	async showInputBox(options: vscode.InputBoxOptions): Promise<string | undefined> {
		return vscode.window.showInputBox(options)
	}

	async postMessageToWebview(message: ExtensionMessage) {
		await this.provider["view"]?.webview.postMessage(message)
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
			currentChatMode: koduDevState?.currentChatMode ?? 'task',
			chatHistory: koduDevState?.chatHistory ?? [],
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
			`script-src 'unsafe-eval' https://* ${
				isProd ? `'nonce-${nonce}'` : `http://${localServerUrl} http://0.0.0.0:${localPort} 'unsafe-inline'`
			}`,
			`style-src ${webview.cspSource} 'self' 'unsafe-inline' https://*`,
			`font-src ${webview.cspSource}`,
			`img-src ${webview.cspSource} data:`,
			`connect-src https://* ${
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

	private setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			async (message: WebviewMessage) => {
				switch (message.type) {
					case "action":
						if (message.action === "switchChatMode") {
							await this.provider.getKoduDev()?.switchChatMode(message.mode);
							await this.postStateToWebview();
						} else if (message.action === "chatMessage") {
							await this.provider.getKoduDev()?.handleWebviewAskResponse(
								"messageResponse",
								message.text,
								message.images
							);
						}
						break;
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
}
