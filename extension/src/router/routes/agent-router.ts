import { z } from "zod"
import { procedure } from "../utils"
import { router } from "../utils/router"
import { koduConfig } from "../../api/providers/config/kodu"
import { observerHookDefaultPrompt } from "../../agent/v1/hooks/observer-hook"
import * as vscode from "vscode"
import {
	Uri,
	workspace,
	window,
	commands,
	Disposable,
	FileSystemProvider,
	FileChangeEvent,
	FileStat,
	FileType,
	FileSystemError,
	ViewColumn,
	StatusBarAlignment,
} from "vscode"

class PromptFileSystemProvider implements FileSystemProvider {
	private _content = Buffer.from("")
	private _onDidChangeFile = new vscode.EventEmitter<FileChangeEvent[]>()

	onDidChangeFile = this._onDidChangeFile.event

	watch(): vscode.Disposable {
		return new vscode.Disposable(() => {})
	}

	stat(uri: vscode.Uri): FileStat {
		return {
			type: FileType.File,
			ctime: Date.now(),
			mtime: Date.now(),
			size: this._content.length,
		}
	}

	readFile(uri: vscode.Uri): Uint8Array {
		return this._content
	}

	writeFile(uri: vscode.Uri, content: Uint8Array): void {
		this._content = Buffer.from(content)
		this._onDidChangeFile.fire([{ type: 2, uri }])
	}

	// Required interface members
	readDirectory = () => {
		throw FileSystemError.NoPermissions()
	}
	createDirectory = () => {
		throw FileSystemError.NoPermissions()
	}
	delete = () => {
		throw FileSystemError.NoPermissions()
	}
	rename = () => {
		throw FileSystemError.NoPermissions()
	}
}

const promptFsProvider = new PromptFileSystemProvider()
workspace.registerFileSystemProvider("kodu-prompt", promptFsProvider, { isCaseSensitive: true })

const agentRouter = router({
	getObserverSettings: procedure.input(z.object({})).resolve(async (ctx) => {
		const observerSettings = ctx.provider.getGlobalStateManager().getGlobalState("observerSettings")
		return { observerSettings }
	}),
	enableObserverAgent: procedure
		.input(
			z.object({
				enabled: z.boolean(),
			})
		)
		.resolve(async (ctx, input) => {
			if (!input.enabled) {
				ctx.provider.getGlobalStateManager().updateGlobalState("observerSettings", undefined)
				ctx.provider.getKoduDev()?.observerHookEvery(undefined)
				return { success: true }
			}
			const triggerEveryXRequests = 3
			const pullMessages = 6
			ctx.provider.getGlobalStateManager().updateGlobalState("observerSettings", {
				modelId: koduConfig.models[0].id,
				providerId: koduConfig.id,
				observeEveryXRequests: triggerEveryXRequests,
				observePullMessages: pullMessages,
			})
			ctx.provider.getKoduDev()?.observerHookEvery(triggerEveryXRequests)

			return { success: true }
		}),
	updateObserverAgent: procedure
		.input(
			z
				.object({
					clearPrompt: z.boolean().optional(),
					observeEveryXRequests: z.number().positive(),
					observePullMessages: z.number().positive(),
					modelId: z.string().optional(),
				})
				.partial()
		)
		.resolve(async (ctx, input) => {
			const { clearPrompt, ...rest } = input
			ctx.provider.getGlobalStateManager().updatePartialGlobalState("observerSettings", rest)
			if (clearPrompt) {
				const config = ctx.provider.getGlobalStateManager().getGlobalState("observerSettings")
				if (config) {
					ctx.provider.getGlobalStateManager().updateGlobalState("observerSettings", {
						...config,
						observePrompt: undefined,
					})
				}
			}
			if (input.observeEveryXRequests) {
				ctx.provider.getKoduDev()?.observerHookEvery(input.observeEveryXRequests)
			}
			return { success: true }
		}),
	customizeObserverPrompt: procedure.input(z.object({})).resolve(async (ctx) => {
		const defaultPrompt = observerHookDefaultPrompt
		const config = ctx.provider.getGlobalStateManager().getGlobalState("observerSettings")

		// Use a constant URI for single instance
		const uri = Uri.parse("kodu-prompt:/Kodu Observer Prompt.md")

		// Check for existing editor
		const existingDoc = workspace.textDocuments.find((d) => d.uri.toString() === uri.toString())
		if (existingDoc) {
			await window.showTextDocument(existingDoc, {
				viewColumn: ViewColumn.One,
				preserveFocus: true,
			})
			return { success: true }
		}

		// Initialize content
		const initialContent = config?.observePrompt || defaultPrompt
		promptFsProvider.writeFile(uri, Buffer.from(initialContent))

		try {
			let saved = true
			const doc = await workspace.openTextDocument(uri)
			const editor = await window.showTextDocument(doc, {
				viewColumn: ViewColumn.One,
				preview: false,
			})

			// Status bar elements
			const statusBar = window.createStatusBarItem(StatusBarAlignment.Right, 100)
			const updateStatus = () => {
				statusBar.text = `${saved ? "$(pass) Saved" : "$(circle-slash) Unsaved changes"}`
				statusBar.color = saved ? new vscode.ThemeColor("statusBar.foreground") : "#ff9900"
				statusBar.tooltip = saved ? "All changes saved" : "Unsaved changes - Click to save"
			}
			updateStatus()
			statusBar.show()

			// Save command with status update
			const saveHandler = () => {
				ctx.provider.getGlobalStateManager().updatePartialGlobalState("observerSettings", {
					observePrompt: doc.getText(),
				})
				saved = true
				updateStatus()
				window.showInformationMessage("Prompt saved")
			}

			// Handle content changes
			const changeDisposable = workspace.onDidChangeTextDocument((e) => {
				if (e.document.uri.toString() === uri.toString()) {
					saved = false
					updateStatus()
				}
			})

			const documentSaveDisposable = workspace.onDidSaveTextDocument((e) => {
				if (e.uri.toString() === uri.toString()) {
					saveHandler()
				}
			})

			// Register save command
			const saveDisposable = commands.registerCommand("kodu.savePrompt", saveHandler)

			// Auto-save on close
			const closeDisposable = window.onDidChangeActiveTextEditor(async (e) => {
				if (!e || e.document.uri.toString() !== uri.toString()) {
					if (!saved) {
						saveHandler()
					}
					statusBar.dispose()
					changeDisposable.dispose()
					saveDisposable.dispose()
					closeDisposable.dispose()
					documentSaveDisposable.dispose()
				}
			})
		} catch (error) {
			window.showErrorMessage(`Prompt editor error: ${error}`)
		}

		return { success: true }
	}),
})

export default agentRouter
