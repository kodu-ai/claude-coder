import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"
import { KoduDev } from "../agent/v1"
import { ExtensionMessage } from "../shared/ExtensionMessage"
import { WebviewMessage } from "../shared/WebviewMessage"
import { compressImages, downloadTask, getNonce, getUri, selectImages } from "../utils"
import * as path from "path"
import fs from "fs/promises"
import { HistoryItem } from "../shared/HistoryItem"
import { fetchKoduUser as fetchKoduUserAPI } from "../api/kodu"
import { ApiModelId } from "../shared/api"
import { amplitudeTracker } from "../utils/amplitude"
import { executeAction } from "./actions"

/*
https://github.com/microsoft/vscode-webview-ui-vite-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts

https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
*/

type SecretKey = "koduApiKey"
export type GlobalStateKey =
	| "apiModelId"
	| "user"
	| "maxRequestsPerTask"
	| "lastShownAnnouncementId"
	| "customInstructions"
	| "alwaysAllowReadOnly"
	| "alwaysAllowWriteOnly"
	| "taskHistory"
	| "shouldShowKoduPromo"
	| "creativeMode"

export class ClaudeDevProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = "kodu-claude-coder-upstream.SidebarProvider" // used in package.json as the view's id. This value cannot be changed due to how vscode caches views based on their id, and updating the id would break existing instances of the extension.
	public static readonly tabPanelId = "kodu-claude-coder-upstream.TabPanelProvider"
	public disposables: vscode.Disposable[] = []
	public view?: vscode.WebviewView | vscode.WebviewPanel
	public koduDev?: KoduDev
	public latestAnnouncementId = "aug-28-2024" // update to some unique identifier when we add a new announcement

	constructor(readonly context: vscode.ExtensionContext, public readonly outputChannel: vscode.OutputChannel) {
		this.outputChannel.appendLine("ClaudeDevProvider instantiated")
	}

	/*
	VSCode extensions use the disposable pattern to clean up resources when the sidebar/editor tab is closed by the user or system. This applies to event listening, commands, interacting with the UI, etc.
	- https://vscode-docs.readthedocs.io/en/stable/extensions/patterns-and-principles/
	- https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	*/
	async dispose() {
		this.outputChannel.appendLine("Disposing ClaudeDevProvider...")
		await this.clearTask()
		this.outputChannel.appendLine("Cleared task")
		if (this.view && "dispose" in this.view) {
			this.view.dispose()
			this.outputChannel.appendLine("Disposed webview")
		}
		while (this.disposables.length) {
			const x = this.disposables.pop()
			if (x) {
				x.dispose()
			}
		}
		this.outputChannel.appendLine("Disposed all disposables")
	}

	resolveWebviewView(
		webviewView: vscode.WebviewView | vscode.WebviewPanel
		//context: vscode.WebviewViewResolveContext<unknown>, used to recreate a deallocated webview, but we don't need this since we use retainContextWhenHidden
		//token: vscode.CancellationToken
	): void | Thenable<void> {
		this.outputChannel.appendLine("Resolving webview view")
		this.view = webviewView

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		}
		webviewView.webview.html = this.getHtmlContent(webviewView.webview)

		// Sets up an event listener to listen for messages passed from the webview view context
		// and executes code based on the message that is recieved
		this.setWebviewMessageListener(webviewView.webview)

		// Logs show up in bottom panel > Debug Console
		//console.log("registering listener")

		// Listen for when the panel becomes visible
		// https://github.com/microsoft/vscode-discussions/discussions/840
		if ("onDidChangeViewState" in webviewView) {
			// WebviewView and WebviewPanel have all the same properties except for this visibility listener
			// panel
			webviewView.onDidChangeViewState(
				() => {
					if (this.view?.visible) {
						this.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
					}
				},
				null,
				this.disposables
			)
		} else if ("onDidChangeVisibility" in webviewView) {
			// sidebar
			webviewView.onDidChangeVisibility(
				() => {
					if (this.view?.visible) {
						this.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
					}
				},
				null,
				this.disposables
			)
		}

		// Listen for when the view is disposed
		// This happens when the user closes the view or when the view is closed programmatically
		webviewView.onDidDispose(
			async () => {
				await this.dispose()
			},
			null,
			this.disposables
		)

		// Listen for when color changes
		vscode.workspace.onDidChangeConfiguration(
			(e) => {
				if (e && e.affectsConfiguration("workbench.colorTheme")) {
					// Sends latest theme name to webview
					this.postStateToWebview()
				}
			},
			null,
			this.disposables
		)

		// if the extension is starting a new session, clear previous task state
		this.clearTask()
		this.outputChannel.appendLine("Webview view resolved")
	}

	async fetchKoduUser() {
		const koduApiKey = await this.getSecret("koduApiKey")
		if (koduApiKey) {
			return await fetchKoduUserAPI({ apiKey: koduApiKey })
		}
		return null
	}

	async initClaudeDevWithTask(task?: string, images?: string[]) {
		await this.clearTask() // ensures that an exising task doesn't exist before starting a new one, although this shouldn't be possible since user must clear task before starting a new one
		const {
			maxRequestsPerTask,
			apiConfiguration,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			creativeMode,
		} = await this.getState()
		this.koduDev = new KoduDev({
			provider: this,
			apiConfiguration: { ...apiConfiguration, koduApiKey: apiConfiguration.koduApiKey },
			maxRequestsPerTask,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			task,
			images,
			creativeMode,
		})
	}

	async initClaudeDevWithHistoryItem(historyItem: HistoryItem) {
		await this.clearTask()
		const { maxRequestsPerTask, apiConfiguration, customInstructions, alwaysAllowReadOnly, alwaysAllowWriteOnly } =
			await this.getState()
		this.koduDev = new KoduDev({
			provider: this,
			apiConfiguration: { ...apiConfiguration, koduApiKey: apiConfiguration.koduApiKey },
			maxRequestsPerTask,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			historyItem,
		})
	}

	// Send any JSON serializable data to the react app
	async postMessageToWebview(message: ExtensionMessage) {
		await this.view?.webview.postMessage(message)
	}

	/**
	 * Defines and returns the HTML that should be rendered within the webview panel.
	 *
	 * @remarks This is also the place where references to the React webview build files
	 * are created and inserted into the webview HTML.
	 *
	 * @param webview A reference to the extension webview
	 * @param extensionUri The URI of the directory containing the extension
	 * @returns A template string literal containing the HTML that should be
	 * rendered within the webview panel
	 */
	public getHtmlContent(webview: vscode.Webview): string {
		// Get the local path to main script run in the webview,
		// then convert it to a uri we can use in the webview.
		const localPort = "5173"
		const localServerUrl = `localhost:${localPort}`
		let scriptUri
		const isProd = this.context.extensionMode === vscode.ExtensionMode.Production
		if (isProd) {
			// The JS file from the React build output
			scriptUri = getUri(webview, this.context.extensionUri, ["webview-ui-vite", "build", "assets", "index.js"])
		} else {
			scriptUri = `http://${localServerUrl}/src/index.tsx`
		}

		// The CSS file from the React build output
		const stylesUri = getUri(webview, this.context.extensionUri, [
			"webview-ui-vite",
			"build",
			"assets",
			"index.css",
		])

		// The codicon font from the React build output
		// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-codicons-sample/src/extension.ts
		// we installed this package in the extension so that we can access it how its intended from the extension (the font file is likely bundled in vscode), and we just import the css fileinto our react app we don't have access to it
		// don't forget to add font-src ${webview.cspSource};
		const codiconsUri = getUri(webview, this.context.extensionUri, [
			"node_modules",
			"@vscode",
			"codicons",
			"dist",
			"codicon.css",
		])

		// Use a nonce to only allow a specific script to be run.
		/*
	    content security policy of your webview to only allow scripts that have a specific nonce
	    create a content security policy meta tag so that only loading scripts with a nonce is allowed
	    As your extension grows you will likely want to add custom styles, fonts, and/or images to your webview. If you do, you will need to update the content security policy meta tag to explicity allow for these resources. E.g.
	            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
		- 'unsafe-inline' is required for styles due to vscode-webview-toolkit's dynamic style injection
		- since we pass base64 images to the webview, we need to specify img-src ${webview.cspSource} data:;

	    in meta tag we add nonce attribute: A cryptographic nonce (only used once) to allow scripts. The server must generate a unique nonce value each time it transmits a policy. It is critical to provide a nonce that cannot be guessed as bypassing a resource's policy is otherwise trivial.
	    */
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

		// Tip: Install the es6-string-html VS Code extension to enable code highlighting below
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
	        <title>Claude Dev</title>
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
	 * Sets up an event listener to listen for messages passed from the webview context and
	 * executes code based on the message that is recieved.
	 *
	 * @param webview A reference to the extension webview
	 */
	public setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			async (message: WebviewMessage) => {
				await executeAction(this, message)
			},
			null,
			this.disposables
		)
	}

	// Kodu

	async saveKoduApiKey(apiKey: string, email?: string) {
		console.log("Saving Kodu API key")
		await this.storeSecret("koduApiKey", apiKey)
		await this.updateGlobalState("shouldShowKoduPromo", false)
		const user = await fetchKoduUserAPI({ apiKey })
		await this.updateGlobalState("user", user)

		console.log(`fetchKoduUser ${JSON.stringify(user)}`)
		console.log("Saved Kodu API key")
		await this.postStateToWebview()
		console.log("Posted state to webview after saving Kodu API key")
		await this.postMessageToWebview({ type: "action", action: "koduAuthenticated" })
		console.log("Posted message to action: koduAuthenticated")
		this.koduDev?.getStateManager().apiManager.updateApi({ koduApiKey: apiKey })
	}

	async signOutKodu() {
		await this.storeSecret("koduApiKey", undefined)
		await this.updateGlobalState("user", undefined)
		this.koduDev?.getStateManager().apiManager.updateApi({ koduApiKey: undefined })
		await this.postStateToWebview()
	}

	// Task history

	async getTaskWithId(id: string): Promise<{
		historyItem: HistoryItem
		taskDirPath: string
		apiConversationHistoryFilePath: string
		claudeMessagesFilePath: string
		apiConversationHistory: Anthropic.MessageParam[]
	}> {
		const history = ((await this.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const historyItem = history.find((item) => item.id === id)
		if (historyItem) {
			const taskDirPath = path.join(this.context.globalStorageUri.fsPath, "tasks", id)
			const apiConversationHistoryFilePath = path.join(taskDirPath, "api_conversation_history.json")
			const claudeMessagesFilePath = path.join(taskDirPath, "claude_messages.json")
			const fileExists = await fs
				.access(apiConversationHistoryFilePath)
				.then(() => true)
				.catch(() => false)
			if (fileExists) {
				const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))
				return {
					historyItem,
					taskDirPath,
					apiConversationHistoryFilePath,
					claudeMessagesFilePath,
					apiConversationHistory,
				}
			}
		}
		// if we tried to get a task that doesn't exist, remove it from state
		await this.deleteTaskFromState(id)
		throw new Error("Task not found")
	}

	async showTaskWithId(id: string) {
		if (id !== this.koduDev?.getStateManager().state.taskId) {
			// non-current task
			const { historyItem } = await this.getTaskWithId(id)
			await this.initClaudeDevWithHistoryItem(historyItem) // clears existing task
		}
		await this.postMessageToWebview({ type: "action", action: "chatButtonTapped" })
	}

	async exportTaskWithId(id: string) {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id)
		await downloadTask(historyItem.ts, apiConversationHistory)
	}

	async deleteTaskWithId(id: string) {
		if (id === this.koduDev?.getStateManager().state.taskId) {
			await this.clearTask()
		}

		const { taskDirPath, apiConversationHistoryFilePath, claudeMessagesFilePath } = await this.getTaskWithId(id)

		// Delete the task files
		const apiConversationHistoryFileExists = await fs
			.access(apiConversationHistoryFilePath)
			.then(() => true)
			.catch(() => false)
		if (apiConversationHistoryFileExists) {
			await fs.unlink(apiConversationHistoryFilePath)
		}
		const claudeMessagesFileExists = await fs
			.access(claudeMessagesFilePath)
			.then(() => true)
			.catch(() => false)
		if (claudeMessagesFileExists) {
			await fs.unlink(claudeMessagesFilePath)
		}
		await fs.rmdir(taskDirPath) // succeeds if the dir is empty

		await this.deleteTaskFromState(id)
	}

	async deleteTaskFromState(id: string) {
		// Remove the task from history
		const taskHistory = ((await this.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id)
		await this.updateGlobalState("taskHistory", updatedTaskHistory)

		// Notify the webview that the task has been deleted
		await this.postStateToWebview()
	}

	async postStateToWebview() {
		const state = await this.getStateToPostToWebview()
		this.postMessageToWebview({ type: "state", state })
	}

	async getStateToPostToWebview() {
		const {
			apiConfiguration,
			maxRequestsPerTask,
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			user,
			taskHistory,
			shouldShowKoduPromo,
			creativeMode,
		} = await this.getState()
		const koduDevState = this.koduDev?.getStateManager().state
		const extensionName = this.context.extension?.packageJSON?.name
		console.log(`extensionName: ${extensionName}`)
		return {
			version: this.context.extension?.packageJSON?.version ?? "",
			apiConfiguration,
			maxRequestsPerTask,
			customInstructions,
			user,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			creativeMode,
			themeName: vscode.workspace.getConfiguration("workbench").get<string>("colorTheme"),
			uriScheme: vscode.env.uriScheme,
			extensionName,
			claudeMessages: koduDevState?.claudeMessages ?? [],
			taskHistory: (taskHistory || []).filter((item) => item.ts && item.task).sort((a, b) => b.ts - a.ts),
			shouldShowAnnouncement: lastShownAnnouncementId !== this.latestAnnouncementId,
			shouldShowKoduPromo,
		}
	}

	async clearTask() {
		this.koduDev?.abortTask()
		this.koduDev = undefined // removes reference to it, so once promises end it will be garbage collected
	}

	async getState() {
		const [
			apiModelId,
			koduApiKey,
			user,
			maxRequestsPerTask,
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWriteOnly,
			taskHistory,
			shouldShowKoduPromo,
			creativeMode,
		] = await Promise.all([
			this.getGlobalState("apiModelId") as Promise<ApiModelId | undefined>,
			this.getSecret("koduApiKey") as Promise<string | undefined>,
			this.getGlobalState("user") as Promise<{ email: string; credits: number; id: string } | undefined>,
			this.getGlobalState("maxRequestsPerTask") as Promise<number | undefined>,
			this.getGlobalState("lastShownAnnouncementId") as Promise<string | undefined>,
			this.getGlobalState("customInstructions") as Promise<string | undefined>,
			this.getGlobalState("alwaysAllowReadOnly") as Promise<boolean | undefined>,
			this.getGlobalState("alwaysAllowWriteOnly") as Promise<boolean | undefined>,
			this.getGlobalState("taskHistory") as Promise<HistoryItem[] | undefined>,
			this.getGlobalState("shouldShowKoduPromo") as Promise<boolean | undefined>,
			this.getGlobalState("creativeMode") as Promise<"creative" | "normal" | "deterministic" | undefined>,
		])

		const apiConfig = {
			apiConfiguration: {
				apiModelId,
				koduApiKey,
			},
			user,
			maxRequestsPerTask,
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly: alwaysAllowReadOnly ?? false,
			alwaysAllowWriteOnly: alwaysAllowWriteOnly ?? false,
			taskHistory,
			shouldShowKoduPromo: shouldShowKoduPromo ?? true,
			creativeMode: creativeMode ?? "normal",
		}
		return apiConfig
	}

	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = ((await this.getGlobalState("taskHistory")) as HistoryItem[]) || []
		const existingItemIndex = history.findIndex((h) => h.id === item.id)
		if (existingItemIndex !== -1) {
			history[existingItemIndex] = item
		} else {
			history.push(item)
		}
		await this.updateGlobalState("taskHistory", history)
		return history
	}

	async updateKoduCredits(credits: number) {
		const user = (await this.getGlobalState("user")) as { email: string; credits: number } | undefined
		if (user) {
			console.log(`updateKoduCredits credits: ${credits} - ${user.email}`)
			user.credits = credits
			await this.updateGlobalState("user", user)
		}
	}

	// global

	public async updateGlobalState(key: GlobalStateKey, value: any) {
		await this.context.globalState.update(key, value)
	}

	public async getGlobalState(key: GlobalStateKey) {
		return await this.context.globalState.get(key)
	}

	// workspace

	public async updateWorkspaceState(key: string, value: any) {
		await this.context.workspaceState.update(key, value)
	}

	public async storeSecret(key: SecretKey, value?: string) {
		if (value) {
			await this.context.secrets.store(key, value)
		} else {
			await this.context.secrets.delete(key)
		}
	}

	public async getSecret(key: SecretKey) {
		return await this.context.secrets.get(key)
	}

	// dev

	async resetState() {
		vscode.window.showInformationMessage("Resetting state...")
		for (const key of this.context.globalState.keys()) {
			await this.context.globalState.update(key, undefined)
		}
		const secretKeys: SecretKey[] = ["koduApiKey"]
		for (const key of secretKeys) {
			await this.storeSecret(key, undefined)
		}
		if (this.koduDev) {
			this.koduDev.abortTask()
			this.koduDev = undefined
		}
		vscode.window.showInformationMessage("State reset")
		await this.postStateToWebview()
		await this.postMessageToWebview({ type: "action", action: "chatButtonTapped" })
	}
}
