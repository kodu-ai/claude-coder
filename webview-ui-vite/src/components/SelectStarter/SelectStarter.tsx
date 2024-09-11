import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import * as vscode from "vscode"

function selectStarter() {
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

export function SelectStarterButton() {
	return <VSCodeButton onClick={() => selectStarter()}>Choose a starter</VSCodeButton>
}
