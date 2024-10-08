import * as vscode from "vscode"
import { ExtensionMessage, ExtensionState } from "../../../shared/ExtensionMessage"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { getNonce, getUri } from "../../../utils"
import { ClaudeDevProvider } from "../ClaudeCoderProvider"
import { quickStart } from "./quick-start"
import { readdir } from "fs/promises"
import path from "path"
import { AmplitudeWebviewManager } from "../../../utils/amplitude/manager"

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

	constructor(private provider: ClaudeDevProvider) {}

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
		this.postMessageToWebview({ type: "state", state })
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
			// shouldShowAnnouncement: state.lastShownAnnouncementId !== WebviewManager.latestAnnouncementId,
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

		// const csp = [
		// 	`default-src 'none';`,
		// 	`script-src 'unsafe-eval' https://* ${
		// 		isProd ? `'nonce-${nonce}'` : `http://${localServerUrl} http://0.0.0.0:${localPort} 'unsafe-inline'`
		// 	}`,
		// 	`style-src ${webview.cspSource} 'self' 'unsafe-inline' https://*`,
		// 	`font-src ${webview.cspSource}`,
		// 	`img-src ${webview.cspSource} data:`,
		// 	`connect-src https://* ${
		// 		isProd
		// 			? ``
		// 			: `ws://${localServerUrl} ws://0.0.0.0:${localPort} http://${localServerUrl} http://0.0.0.0:${localPort}`
		// 	}`,
		// 	`frame-src https://*`,
		// 	`child-src https://*`,
		// 	`window-open https://*`,
		// ]
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

			const id = parentId ? `${parentId}-${entry.name}` : entry.name
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
							await this.provider.initClaudeDevWithTask(description, [])
						}
						await quickStart(message.repo, message.name, callback)
						break
					case "exportBug":
						console.log("Export bug message received")
						await this.provider.getTaskManager().exportBug(message.description, message.reproduction)
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
					case "amplitude":
						AmplitudeWebviewManager.handleMessage(message)
						break
					case "cancelCurrentRequest":
						await this.provider.getKoduDev()?.taskExecutor.cancelCurrentRequest()
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
						await this.provider.getTaskManager().handleNewTask(message.text, message.images)
						break
					case "apiConfiguration":
						if (message.apiConfiguration) {
							await this.provider.getApiManager().updateApiConfiguration(message.apiConfiguration)
							await this.postStateToWebview()
						}
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
						await this.provider
							.getTaskManager()
							.handleAskResponse(message.askResponse!, message.text, message.images)
						break
					case "clearTask":
						await this.provider.getTaskManager().clearTask()
						await this.postStateToWebview()
						break
					case "didCloseAnnouncement":
						await this.provider
							.getGlobalStateManager()
							.updateGlobalState("lastShownAnnouncementId", WebviewManager.latestAnnouncementId)
						await this.postStateToWebview()
						break
					case "selectImages":
						const images = await this.provider.getTaskManager().selectImages()
						await this.postMessageToWebview({
							type: "selectedImages",
							images: images.map((img) => img.data),
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
					case "gitLog":
						const history = (await this.provider.getKoduDev()?.gitHandler.getLog()) ?? []

						this.postMessageToWebview({
							type: "gitLog",
							history,
						})
						break
					case "gitCheckoutTo":
						const isSuccess =
							(await this.provider
								.getKoduDev()
								?.gitHandler.checkoutTo(message.identifier, message.newBranchName)) ?? false

						this.postMessageToWebview({
							type: "gitCheckoutTo",
							isSuccess,
						})
						break
					case "gitBranches":
						const branches = (await this.provider.getKoduDev()?.gitHandler.getBranches()) ?? []

						this.postMessageToWebview({
							type: "gitBranches",
							branches,
						})
						break
				}
			},
			null,
			this.provider["disposables"]
		)
	}

	private async handleDebugInstruction(): Promise<void> {
		const agent = this.provider.getKoduDev()!
		const openFolders = vscode.workspace.workspaceFolders

		if (!openFolders) {
			await agent.taskExecutor.say("error", "No open workspaces!")
			return
		}

		if (openFolders.length > 1) {
			await agent.taskExecutor.say("info", "Multiple workspaces detected! Please open only one workspace.")
			return
		}

		const rootPath = openFolders[0].uri.fsPath

		const problemsString = await agent.diagnosticsHandler?.getProblemsString(rootPath)
		if (!problemsString) {
			await agent.taskExecutor.say("info", "No problems detected!")
			return
		}

		return await agent.taskExecutor.handleAskResponse("messageResponse", problemsString)
	}
}
