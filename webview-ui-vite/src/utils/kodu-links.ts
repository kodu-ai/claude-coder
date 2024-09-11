import { getKoduSignInUrl } from "../../../src/shared/kodu"
import { vscode } from "./vscode"

export const loginKodu = (props: { uriScheme: string; extensionName: string }) => {
	vscode.postMessage({
		type: "amplitude",
		event_type: "Auth Start",
	})
	vscode.postMessage({
		type: "openExternalLink",
		url: "https://kodu.ai/auth/login?redirectTo=vscode://kodu-ai.claude-dev-experimental&ext=1",
	})
}

export const freeTrial = (fp: string) => {
	vscode.postMessage({
		type: "freeTrial",
		fp,
	})
}
