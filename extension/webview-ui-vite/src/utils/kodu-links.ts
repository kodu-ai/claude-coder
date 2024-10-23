import { getKoduSignInUrl } from "../../../src/shared/kodu"
import { vscode } from "./vscode"

export const loginKodu = (props: { uriScheme: string; extensionName: string }) => {
	vscode.postTrackingEvent("AuthStart")

	let url = getKoduSignInUrl(props.uriScheme, props.extensionName)
	vscode.postMessage({
		type: "openExternalLink",
		url,
	})
}
