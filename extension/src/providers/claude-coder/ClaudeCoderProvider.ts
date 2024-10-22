import * as vscode from 'vscode'
import { KoduDev } from '../../agent/v1'
import { extensionName } from '../../shared/Constants'
import type { HistoryItem } from '../../shared/HistoryItem'
import { ApiManager } from './state/ApiManager'
import { GlobalStateManager } from './state/GlobalStateManager'
import { SecretStateManager } from './state/SecretStateManager'
import { StateManager } from './state/StateManager'
import { TaskManager } from './state/TaskManager'
import { WebviewManager } from './webview/WebviewManager'

export class ExtensionProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = `${extensionName}.SidebarProvider`
	public static readonly tabPanelId = `${extensionName}.TabPanelProvider`
	public disposables: vscode.Disposable[] = []
	public view?: vscode.WebviewView | vscode.WebviewPanel
	private koduDev?: KoduDev
	private stateManager: StateManager
	private webviewManager: WebviewManager
	private secretStateManager: SecretStateManager
	private taskManager: TaskManager
	private globalStateManager: GlobalStateManager
	private apiManager: ApiManager

	constructor(
		readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel,
	) {
		this.outputChannel.appendLine('ExtensionProvider instantiated')
		this.globalStateManager = new GlobalStateManager(context)
		this.secretStateManager = new SecretStateManager(context)
		this.stateManager = new StateManager(this)
		this.webviewManager = new WebviewManager(this)
		this.taskManager = new TaskManager(this)
		this.apiManager = new ApiManager(this)
	}

	async dispose() {
		this.outputChannel.appendLine('Disposing ExtensionProvider...')
		await this.taskManager.clearTask()
		this.outputChannel.appendLine('Cleared task')
		if (this.view && 'dispose' in this.view) {
			this.view.dispose()
			this.outputChannel.appendLine('Disposed webview')
		}
		while (this.disposables.length) {
			const x = this.disposables.pop()
			if (x) {
				x.dispose()
			}
		}
		this.outputChannel.appendLine('Disposed all disposables')
	}

	resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): void | Thenable<void> {
		this.outputChannel.appendLine('Resolving webview view')
		this.view = webviewView

		this.webviewManager.setupWebview(webviewView)

		// Listen for when the view is disposed
		webviewView.onDidDispose(
			async () => {
				await this.dispose()
			},
			null,
			this.disposables,
		)

		// Listen for when color changes
		vscode.workspace.onDidChangeConfiguration(
			(e) => {
				if (e?.affectsConfiguration('workbench.colorTheme')) {
					// Sends latest theme name to webview
					this.webviewManager.postStateToWebview()
				}
			},
			null,
			this.disposables,
		)

		// if the extension is starting a new session, clear previous task state
		this.taskManager.clearTask()
		this.outputChannel.appendLine('Webview view resolved')
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
			autoCloseTerminal: state.autoCloseTerminal,
			creativeMode: state.creativeMode,
			summarizationThreshold: state.summarizationThreshold,
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
			experimentalTerminal: state.experimentalTerminal,
			creativeMode: state.creativeMode,
			summarizationThreshold: state.summarizationThreshold,
			skipWriteAnimation: state.skipWriteAnimation,
			autoCloseTerminal: state.autoCloseTerminal,
			historyItem,
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
