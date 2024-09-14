
import * as vscode from "vscode"

export function selectStarter() {
	vscode.window
		.showQuickPick(["React", "Vue", "Svelte"], {
			canPickMany: false,
			placeHolder: "Select a starter",
		})
		.then((selected) => {
			if (selected) {
				vscode.window.showInformationMessage(`You selected ${selected}`)
			}
		})
}