import type { GlobalState } from '../../../../src/providers/claude-coder/state/GlobalStateManager'

export interface ExperimentalFeature {
	id: keyof GlobalState
	label: string
	description: string
	disabled?: boolean
	comingSoon?: boolean
}
