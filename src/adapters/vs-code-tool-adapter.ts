import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import { BaseAdapter } from "./base-tool-adapter"
import { AdapterTextDocument } from "./interfaces"

export class VSCodeAdapter implements BaseAdapter {
	async showTextDocument(filePath: string, options?: { preview: boolean }): Promise<void> {
		await vscode.window.showTextDocument(vscode.Uri.file(filePath), options)
	}

	async executeCommand(command: string, ...args: any[]): Promise<void> {
		await vscode.commands.executeCommand(command, ...args)
	}

	async showDiffView(
		originalUri: string,
		originalContent: string,
		tempFilePath: string,
		title: string
	): Promise<void> {
		await vscode.commands.executeCommand(
			"vscode.diff",
			vscode.Uri.parse(originalUri).with({
				query: Buffer.from(originalContent).toString("base64"),
			}),
			vscode.Uri.file(tempFilePath),
			title
		)
	}

	async closeDiffViews(): Promise<void> {
		const tabs = vscode.window.tabGroups.all
			.map((tg) => tg.tabs)
			.flat()
			.filter((tab) => tab.input instanceof vscode.TabInputTextDiff && tab.input?.modified?.scheme === "kodu")

		for (const tab of tabs) {
			await vscode.window.tabGroups.close(tab)
		}
	}

	getWorkspaceTextDocuments(): AdapterTextDocument[] {
		return vscode.workspace.textDocuments.map((doc) => ({
			uri: { fsPath: doc.uri.fsPath },
			isDirty: doc.isDirty,
			save: () => doc.save(),
		}))
	}

	// File operations using vscode.workspace.fs
	async readFile(path: string, encoding: string): Promise<string> {
		const uri = vscode.Uri.file(path)
		const uint8Array = await vscode.workspace.fs.readFile(uri)
		const decoder = new TextDecoder(encoding)
		return decoder.decode(uint8Array)
	}

	async writeFile(path: string, data: string, options?: { encoding?: string; flag?: string }): Promise<void> {
		const uri = vscode.Uri.file(path)
		const encoder = new TextEncoder()
		const uint8Array = encoder.encode(data)
		await vscode.workspace.fs.writeFile(uri, uint8Array)
	}

	async access(path: string): Promise<boolean> {
		const uri = vscode.Uri.file(path)
		try {
			await vscode.workspace.fs.stat(uri)
			return true
		} catch {
			return false
		}
	}

	async mkdir(path: string, options: { recursive: boolean }): Promise<void> {
		const uri = vscode.Uri.file(path)
		await vscode.workspace.fs.createDirectory(uri)
	}

	async rmdir(path: string, options: { recursive: boolean; force: boolean }): Promise<void> {
		const uri = vscode.Uri.file(path)
		await vscode.workspace.fs.delete(uri, { recursive: options.recursive, useTrash: !options.force })
	}

	async createTempDir(path: string): Promise<string> {
		const tempPath = this.createPath(os.tmpdir(), path)
		await this.mkdir(tempPath, { recursive: true })

		return tempPath
	}

	createPath(directory: string, filePath: string): string {
		return path.join(directory, filePath)
	}

	pathUtil(): typeof path {
		return path
	}
}
