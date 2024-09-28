import { getKoduSignInUrl } from "../../../src/shared/kodu"
import { vscode } from "./vscode"

export const loginKodu = (props: { uriScheme: string; extensionName: string }) => {
	vscode.postMessage({
		type: "amplitude",
		event_type: "AuthStart",
	})
	vscode.postMessage({
		type: "openExternalLink",
		url: getKoduSignInUrl(props.uriScheme, props.extensionName),
	})
}

export const freeTrial = (fp: string) => {
	vscode.postMessage({
		type: "freeTrial",
		fp,
	})
}
