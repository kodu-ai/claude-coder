import { amplitudeTracker } from "."
import { AmplitudeWebviewMessage } from "../../shared/WebviewMessage"

export class AmplitudeWebviewManager {
	static handleMessage(message: AmplitudeWebviewMessage) {
		switch (message.event_type) {
			case "AddCredits":
				amplitudeTracker.addCreditsClick()
				break
			case "ReferralProgram":
				amplitudeTracker.referralProgramClick()
				break
			case "AuthStart":
				amplitudeTracker.authStart()
				break
		}
	}
}
