import { koduModels, KoduModels } from "../../../../src/shared/api"
import { Badge } from "../ui/badge"
import { ExperimentalFeature } from "./types"

export const models: Record<
	keyof KoduModels,
	KoduModels[keyof KoduModels] & {
		label: string | React.ReactNode
		disabled?: boolean
		comingSoon?: boolean
		isRecommended?: boolean
		isHardWorker?: boolean
		isBrowserModel?: boolean
	}
> = {
	"claude-3-5-sonnet-20240620": {
		...koduModels["claude-3-5-sonnet-20240620"],
		label: "Claude 3.5 Sonnet",
		isRecommended: true,
		isHardWorker: true,
		isBrowserModel: true,
	},
	"claude-3-opus-20240229": {
		...koduModels["claude-3-opus-20240229"],
		label: "Claude 3 Opus",
		isBrowserModel: false,
	},
	"claude-3-haiku-20240307": {
		...koduModels["claude-3-haiku-20240307"],
		label: "Claude 3 Haiku",
		isBrowserModel: true,
	},
	"claude-3-5-haiku-20241022": {
		...koduModels["claude-3-5-haiku-20241022"],
		label: "Claude 3.5 Haiku",
	},
}

export const experimentalFeatures: ExperimentalFeature[] = [
	{
		id: "alwaysAllowWriteOnly",
		label: "Automatic Mode",
		description: "Claude will automatically try to solve tasks without asking for permission",
	},
	{
		id: "isContinueGenerationEnabled",
		label: "Continue Generation",
		dangerous: `This feature can lead to unexpected results and increased cost, use with caution`,
		description:
			"Claude will automatically continue generating text if max tokens is reached, useful when working with large files",
	},
	{
		id: "autoSummarize",
		label: "AutoSummarize Chat",
		description:
			"Automatically compress chat messages once context window is overflown while preserving the critical flow of the conversation",
		disabled: false,
		comingSoon: false,
	},
	{
		id: "apiModelId",
		label: "One Click Deployment",
		description: "Deploy your projects with a single click",
		disabled: true,
		comingSoon: true,
	},
]
