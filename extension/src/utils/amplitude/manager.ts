import { amplitudeTracker } from '.'
import type { AmplitudeWebviewMessage } from '../../shared/WebviewMessage'

export class AmplitudeWebviewManager {
	static handleMessage(message: AmplitudeWebviewMessage) {
		switch (message.event_type) {
			case 'OfferwallView':
				amplitudeTracker.offerwallView()
				break
			case 'ExtensionCreditAddOpen':
				amplitudeTracker.addCreditsClick()
				break
			case 'ReferralProgram':
				amplitudeTracker.referralProgramClick()
				break
			case 'AuthStart':
				amplitudeTracker.authStart()
				break
			case 'TrialOfferView':
				amplitudeTracker.trialOfferView()
				break
			case 'TrialOfferStart':
				amplitudeTracker.trialOfferStart()
				break
			case 'TrialUpsellView':
				amplitudeTracker.trialUpsellView()
				break
			case 'TrialUpsellStart':
				amplitudeTracker.trialUpsellStart()
				break
			case 'ExtensionCreditAddSelect':
				amplitudeTracker.extensionCreditAddSelect(message.key!)
				break
		}
	}
}
