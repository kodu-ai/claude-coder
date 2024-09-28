import { getKoduSignInUrl } from "../../../src/shared/kodu"
import { vscode } from "./vscode"

export const loginKodu = (props: { uriScheme: string; extensionName: string; isPostTrial?: boolean }) => {
	vscode.postTrackingEvent("AuthStart")

	let url = getKoduSignInUrl(props.uriScheme, props.extensionName)
	if (props.isPostTrial) {
		url += "&postTrial=1"
	}
	vscode.postMessage({
		type: "openExternalLink",
		url,
	})
}

export const freeTrial = (fp: string) => {
	vscode.postMessage({
		type: "freeTrial",
		fp,
	})
}
