import { WebviewMessage } from "../../shared/messages/client-message"
import { ExtensionMessage } from "../../shared/messages/extension-message"
import { getNonce, getUri } from "../../utils"
import { PromptStateManager } from "../state/prompt-state-manager"
import { WebviewManager } from "./webview-manager"
import * as vscode from "vscode"
export class PromptManager {
	private webviewManager: WebviewManager
	private promptEditorPanel: vscode.WebviewPanel | undefined

	constructor(webviewManager: WebviewManager) {
		this.webviewManager = webviewManager
	}
	private getPromptEditorHtmlContent(webview: vscode.Webview): string {
		const localPort = "5173"
		const localServerUrl = `localhost:${localPort}`
		let scriptUri
		const isProd = this.webviewManager.provider.getContext().extensionMode === vscode.ExtensionMode.Production

		if (isProd) {
			scriptUri = getUri(webview, this.webviewManager.provider.getContext().extensionUri, [
				"webview-ui-vite",
				"build",
				"assets",
				"index.js",
			])
		} else {
			scriptUri = `http://${localServerUrl}/src/prompt-editor.tsx`
		}

		const stylesUri = getUri(webview, this.webviewManager.provider.getContext().extensionUri, [
			"webview-ui-vite",
			"build",
			"assets",
			"index.css",
		])

		const codiconsUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this.webviewManager.provider.getContext().extensionUri,
				"dist",
				"codicons",
				"codicon.css"
			)
		)

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
                <title>Prompt Templates</title>
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

	private async createPromptEditorPanel() {
		this.promptEditorPanel = vscode.window.createWebviewPanel(
			"promptEditor",
			"Kodu - Prompt Templates",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [this.webviewManager.provider.getContext().extensionUri],
			}
		)
		this.promptEditorPanel.iconPath = vscode.Uri.joinPath(
			this.webviewManager.provider.getContext().extensionUri,
			"assets",
			"kodu.png"
		)
		await PromptStateManager.init(this.webviewManager.provider.context)

		this.promptEditorPanel.webview.html = this.getPromptEditorHtmlContent(this.promptEditorPanel.webview)
		this.setWebviewMessageListener(this.promptEditorPanel.webview)

		this.promptEditorPanel.onDidDispose(
			() => {
				this.promptEditorPanel = undefined
			},
			null,
			this.webviewManager.provider["disposables"]
		)
	}

	private showPromptEditor() {
		if (this.promptEditorPanel) {
			this.promptEditorPanel.reveal(vscode.ViewColumn.One)
		} else {
			this.createPromptEditorPanel()
		}
	}
	/**
	 * Handles debug instructions for the extension
	 * Analyzes open tabs in the workspace and collects diagnostic information
	 * Creates a new task if needed and processes debugging information
	 * @returns Promise that resolves when debug handling is complete
	 */
	/**
	 * Handles saving a prompt template to disk
	 * @param templateName The name of the template to save
	 * @param content The template content
	 */
	private async savePromptTemplate(templateName: string, content: string): Promise<void> {
		try {
			const promptManager = await PromptStateManager.getInstance()
			await promptManager.saveTemplate(templateName, content)

			await this.postMessageToWebview({
				type: "save_prompt_template",
				templateName,
				content,
			})
		} catch (error) {
			if (error instanceof Error) {
				vscode.window.showErrorMessage(`Failed to save template: ${error.message}`)
			} else {
				vscode.window.showErrorMessage("Failed to save template: Unknown error")
			}
		}
	}
	async postMessageToWebview(message: ExtensionMessage) {
		return await this.promptEditorPanel?.webview.postMessage(message)
	}
	private async listPromptTemplates(): Promise<void> {
		try {
			const promptManager = await PromptStateManager.getInstance()
			const templates = await promptManager.listTemplates()
			const activeTemplate = promptManager.getActivePromptName()

			await this.postMessageToWebview({
				type: "templates_list",
				templates,
				activeTemplate,
			})
		} catch (error) {
			if (error instanceof Error) {
				vscode.window.showErrorMessage(`Failed to list templates: ${error.message}`)
			} else {
				vscode.window.showErrorMessage("Failed to list templates: Unknown error")
			}
			await this.postMessageToWebview({
				type: "templates_list",
				templates: [],
				activeTemplate: null,
			})
		}
	}

	private async loadPromptTemplate(templateName: string): Promise<void> {
		try {
			const promptManager = await PromptStateManager.getInstance()
			const content = await promptManager.loadTemplate(templateName)

			await this.postMessageToWebview({
				type: "load_prompt_template",
				content,
			})
		} catch (error) {
			if (error instanceof Error) {
				vscode.window.showErrorMessage(`Failed to load template: ${error.message}`)
			} else {
				vscode.window.showErrorMessage("Failed to load template: Unknown error")
			}
		}
	}

	private async setActivePrompt(templateName: string | null): Promise<void> {
		try {
			const promptManager = await PromptStateManager.getInstance()
			await promptManager.setActivePrompt(templateName)

			await this.postMessageToWebview({
				type: "set_active_prompt",
				templateName,
			})
		} catch (error) {
			if (error instanceof Error) {
				vscode.window.showErrorMessage(`Failed to set active prompt: ${error.message}`)
			} else {
				vscode.window.showErrorMessage("Failed to set active prompt: Unknown error")
			}
		}
	}
	private setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(async (message: WebviewMessage) => {
			this.handleMessage(message)
		})
	}
	public handleMessage(message: WebviewMessage): void {
		switch (message.type) {
			case "openPromptEditor":
				this.showPromptEditor()
				break
			case "closePromptEditor":
				this.promptEditorPanel?.dispose()
				break
			case "listPromptTemplates":
				this.listPromptTemplates()
				break
			case "savePromptTemplate":
				this.savePromptTemplate(message.templateName, message.content)
				break
			case "loadPromptTemplate":
				this.loadPromptTemplate(message.templateName)
				break
			case "setActivePrompt":
				this.setActivePrompt(message.templateName)
				break
		}
	}
}