import { GlobalState } from "../../../../src/providers/state/global-state-manager"

export interface ExperimentalFeature {
	id: keyof GlobalState
	label: string
	description: string
	disabled?: boolean
	comingSoon?: boolean
	dangerous?: string
}
