import { Badge } from "../ui/badge"
import { ExperimentalFeature } from "./types"

export const experimentalFeatures: ExperimentalFeature[] = [
	{
		id: "alwaysAllowWriteOnly",
		label: "Automatic Mode",
		description: "Claude will automatically try to solve tasks without asking for permission",
	},
	// {
	// 	id: "isAdvanceThinkingEnabled",
	// 	label: "Advance Thinking",
	// 	description: "Claude will generate more reasoning tokens before answering",
	// },
	{
		id: "autoSummarize",
		label: "AutoSummarize Chat",
		description:
			"Automatically compress chat messages once context window is overflown while preserving the critical flow of the conversation",
		disabled: false,
		comingSoon: false,
	},
	{
		id: "taskHistory",
		label: "One Click Deployment",
		description: "Deploy your projects with a single click",
		disabled: true,
		comingSoon: true,
	},
]
