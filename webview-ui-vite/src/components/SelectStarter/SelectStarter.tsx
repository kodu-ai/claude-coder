import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"


export function SelectStarterButton() {
	return <VSCodeButton onClick={() => selectStarter()}>Choose a starter</VSCodeButton>
}
