import * as vscode from "vscode"
import { KoduDev } from "../../agent/v1"
import { StateManager } from "./state/StateManager"
import { WebviewManager } from "./webview/WebviewManager"
import { TaskManager } from "./state/TaskManager"
import { GlobalStateManager } from "./state/GlobalStateManager"
import { ApiManager } from "./state/ApiManager"
import { HistoryItem } from "../../shared/HistoryItem"
import { SecretStateManager } from "./state/SecretStateManager"
import { extensionName } from "../../shared/Constants"

export class ExtensionProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = `${extensionName}.SidebarProvider`
	public static readonly tabPanelId = `${extensionName}.TabPanelProvider`
	private disposables: vscode.Disposable[] = []
	private view?: vscode.WebviewView | vscode.WebviewPanel
	private _koduDev?: KoduDev | undefined
	public get koduDev(): KoduDev | undefined {
		return this._koduDev
	}
	public set koduDev(value: KoduDev | undefined) {
		this._koduDev = value
	}
	private stateManager: StateManager
	private webviewManager: WebviewManager
	private secretStateManager: SecretStateManager
	private taskManager: TaskManager
	private globalStateManager: GlobalStateManager
	private apiManager: ApiManager

	constructor(readonly context: vscode.ExtensionContext, private readonly outputChannel: vscode.OutputChannel) {
		this.outputChannel.appendLine("ExtensionProvider instantiated")
		this.globalStateManager = GlobalStateManager.getInstance(context)
		this.secretStateManager = SecretStateManager.getInstance(context)
		this.stateManager = new StateManager(this)
		this.taskManager = new TaskManager(this)
		this.apiManager = ApiManager.getInstance(this)
		this.webviewManager = new WebviewManager(this)
	}

	async dispose() {
		this.outputChannel.appendLine("Disposing ExtensionProvider...")
		await this.taskManager.clearTask()
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

	resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): void | Thenable<void> {
		this.outputChannel.appendLine("Resolving webview view")
		this.view = webviewView

		this.webviewManager.setupWebview(webviewView)

		// Listen for when the view is disposed
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
					this.webviewManager.postStateToWebview()
				}
			},
			null,
			this.disposables
		)

		// if the extension is starting a new session, clear previous task state
		this.taskManager.clearTask()
		this.outputChannel.appendLine("Webview view resolved")
	}

	async initWithTask(task?: string, images?: string[], isDebug?: boolean) {
		await this.taskManager.clearTask()
		const state = await this.stateManager.getState()
		this.koduDev = new KoduDev({
			provider: this,
			apiConfiguration: { ...state.apiConfiguration, koduApiKey: state.apiConfiguration.koduApiKey },
			maxRequestsPerTask: state.maxRequestsPerTask,
			customInstructions: state.customInstructions,
			alwaysAllowReadOnly: state.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: state.alwaysAllowWriteOnly,
			task,
			images,
			experimentalTerminal: state.experimentalTerminal,
			skipWriteAnimation: state.skipWriteAnimation,
			autoSummarize: state.autoSummarize,
			autoCloseTerminal: state.autoCloseTerminal,
			creativeMode: state.creativeMode,
			isDebug,
		})
	}

	async initWithHistoryItem(historyItem: HistoryItem) {
		await this.taskManager.clearTask()
		const state = await this.stateManager.getState()
		this.koduDev = new KoduDev({
			provider: this,
			apiConfiguration: { ...state.apiConfiguration, koduApiKey: state.apiConfiguration.koduApiKey },
			maxRequestsPerTask: state.maxRequestsPerTask,
			customInstructions: state.customInstructions,
			alwaysAllowReadOnly: state.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: state.alwaysAllowWriteOnly,
			autoSummarize: state.autoSummarize,
			experimentalTerminal: state.experimentalTerminal,
			skipWriteAnimation: state.skipWriteAnimation,
			autoCloseTerminal: state.autoCloseTerminal,
			historyItem,
		})
	}

	/**
	 * useful to initialize the provider without a task (e.g. when the user opens the extension for the first time and you want to test some functionality)
	 */
	async initWithNoTask() {
		await this.taskManager.clearTask()
		const state = await this.stateManager.getState()
		this.koduDev = new KoduDev({
			provider: this,
			apiConfiguration: { ...state.apiConfiguration, koduApiKey: state.apiConfiguration.koduApiKey },
			maxRequestsPerTask: state.maxRequestsPerTask,
			customInstructions: state.customInstructions,
			alwaysAllowReadOnly: state.alwaysAllowReadOnly,
			alwaysAllowWriteOnly: state.alwaysAllowWriteOnly,
			experimentalTerminal: state.experimentalTerminal,
			skipWriteAnimation: state.skipWriteAnimation,
			autoCloseTerminal: state.autoCloseTerminal,
			autoSummarize: state.autoSummarize,
			noTask: true,
		})
	}

	getKoduDev() {
		return this.koduDev
	}

	getStateManager() {
		return this.stateManager
	}

	getState() {
		return this.stateManager.getState()
	}

	getWebviewManager() {
		return this.webviewManager
	}

	getTaskManager() {
		return this.taskManager
	}

	getSecretStateManager() {
		return this.secretStateManager
	}

	getGlobalStateManager() {
		return this.globalStateManager
	}

	getApiManager() {
		return this.apiManager
	}

	getContext() {
		return this.context
	}

	getOutputChannel() {
		return this.outputChannel
	}
}
