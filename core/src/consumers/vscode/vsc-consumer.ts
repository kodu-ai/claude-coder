import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"

import type { IConsumer } from "@/interfaces"
import { getCwd } from "@/utils"
import { IAppPaths, IConsumerFilesAdapter } from "@/interfaces/IConsumer"
import { TerminalManager } from "@/integrations"
import { getVscTerminalManger } from "./vsc-terminal"

export class VSCodeFilesAdapter implements IConsumerFilesAdapter {
	getVisibleFiles(relativeToCwd: boolean = true): string[] {
		return vscode.window.visibleTextEditors
			.map((editor) => editor.document?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => (relativeToCwd ? path.relative(getCwd(), absolutePath).toPosix() : absolutePath))
	}

	getOpenTabs(relativeToCwd: boolean = true): string[] {
		return vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => (relativeToCwd ? path.relative(getCwd(), absolutePath).toPosix() : absolutePath))
	}

	openFile(absolutePath: string): void {
		const uri = vscode.Uri.file(absolutePath)
		vscode.commands.executeCommand("vscode.open", uri)
	}

	async selectImages(): Promise<string[]> {
		const options: vscode.OpenDialogOptions = {
			canSelectMany: true,
			openLabel: "Select",
			filters: {
				Images: ["png", "jpg", "jpeg", "webp"], // supported by anthropic and openrouter
			},
		}

		const fileUris = await vscode.window.showOpenDialog(options)

		if (!fileUris || fileUris.length === 0) {
			return []
		}

		return fileUris.map((uri) => uri.fsPath)
	}

	async showDialogAndSaveFiles(
		folderPath: string,
		fileName: string,
		markdownContent: string,
		filters: Record<string, string[]>
	): Promise<boolean> {
		const saveUri = await vscode.window.showSaveDialog({
			filters,
			defaultUri: vscode.Uri.file(path.join(folderPath, fileName)),
		})

		if (saveUri) {
			// Write content to the selected location
			await vscode.workspace.fs.writeFile(saveUri, Buffer.from(markdownContent))
			vscode.window.showTextDocument(saveUri, { preview: true })

			return true
		}

		return false
	}

	async getDotKoduFileContent(): Promise<string> {
		let dotKoduFileContent = ""
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders) {
			for (const folder of workspaceFolders) {
				const dotKoduFile = vscode.Uri.joinPath(folder.uri, ".kodu")
				try {
					const fileContent = await vscode.workspace.fs.readFile(dotKoduFile)
					dotKoduFileContent = Buffer.from(fileContent).toString("utf8")
					console.log(".kodu file content:", dotKoduFileContent)
					break // Exit the loop after finding and reading the first .kodu file
				} catch (error) {
					console.log(`No .kodu file found in ${folder.uri.fsPath}`)
				}
			}
		}

		return dotKoduFileContent
	}
}

export class VSCodeConsumer implements IConsumer {
	filesAdapter: VSCodeFilesAdapter = new VSCodeFilesAdapter()

	get appPaths(): IAppPaths {
		return {
			appRoot: vscode.env.appRoot,
			binPaths: [
				"node_modules/@vscode/ripgrep/bin/",
				"node_modules/vscode-ripgrep/bin",
				"node_modules.asar.unpacked/vscode-ripgrep/bin/",
				"node_modules.asar.unpacked/@vscode/ripgrep/bin/",
			],
		}
	}

	get terminalManager(): TerminalManager {
		return getVscTerminalManger()
	}
}
