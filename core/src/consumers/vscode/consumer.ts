import * as vscode from "vscode"
import path from "path"
import type { IConsumer } from "@/interfaces"
import { getCwd } from "@/utils"

export class VSCodeConsumer implements IConsumer {
	getVisibleFiles(): string[] {
		return vscode.window.visibleTextEditors
			.map((editor) => editor.document?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(getCwd(), absolutePath).toPosix())
	}

	getOpenTabs(): string[] {
		return vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(getCwd(), absolutePath).toPosix())
	}

	openFile(absolutePath: string): void {
		const uri = vscode.Uri.file(absolutePath)
		vscode.commands.executeCommand("vscode.open", uri)
	}
}
