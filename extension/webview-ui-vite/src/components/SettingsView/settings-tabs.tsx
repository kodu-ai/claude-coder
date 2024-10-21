import React, { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, X, ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { debounce } from "lodash"
import useDebounce from "@/hooks/use-debounce"
import { vscode } from "@/utils/vscode"
import { GlobalState } from "../../../../src/providers/claude-coder/state/GlobalStateManager"
import { koduModels, KoduModels } from "../../../../src/shared/api"
import { formatPrice } from "../ApiOptions/utils"
import { getKoduAddCreditsUrl, getKoduOfferUrl, getKoduReferUrl } from "../../../../src/shared/kodu"

interface ExperimentalFeature {
	id: keyof GlobalState
	label: string
	description: string
	disabled?: boolean
	comingSoon?: boolean
}

// Constants
const models: Record<
	keyof KoduModels,
	KoduModels[keyof KoduModels] & {
		label: string
		disabled?: boolean
		comingSoon?: boolean
		isRecommended?: boolean
		isHardWorker?: boolean
	}
> = {
	"claude-3-5-sonnet-20240620": {
		...koduModels["claude-3-5-sonnet-20240620"],
		label: "Claude 3.5 Sonnet",
		isRecommended: true,
		isHardWorker: true,
	},
	"claude-3-opus-20240229": {
		...koduModels["claude-3-opus-20240229"],
		label: "Claude 3 Opus",
	},
	"claude-3-haiku-20240307": {
		...koduModels["claude-3-haiku-20240307"],
		label: "Claude 3 Haiku",
	},
}

const experimentalFeatures: ExperimentalFeature[] = [
	{
		id: "alwaysAllowWriteOnly",
		label: "Automatic Mode",
		description: "Claude will automatically try to solve tasks without asking for permission",
	},
	{
		id: "experimentalTerminal",
		label: "Experimental Terminal Shell",
		description: "Enable Claude to run shell commands in the terminal directly",
	},
	{
		id: "lastShownAnnouncementId",
		label: "One Click Deployment",
		description: "Deploy your projects with a single click",
		disabled: true,
		comingSoon: true,
	},
	{
		id: "lastShownAnnouncementId",
		label: "AutoSummarize Chat",
		description: "Automatically generate summaries of your chat conversations",
		disabled: true,
		comingSoon: true,
	},
]

// Components
const ModelDetails: React.FC<{ model: keyof KoduModels }> = React.memo(({ model }) => {
	const details = models[model]
	if (!details || details.comingSoon) return null

	return (
		<Collapsible defaultOpen className="w-full">
			<CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs font-medium">
				Model Specifications
				<ChevronDown className="h-3 w-3" />
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-2 text-xs">
				<div className="grid grid-cols-1 gap-1">
					<div>Max Tokens: {details.maxTokens?.toLocaleString()}</div>
					<div>Context Window: {details.contextWindow?.toLocaleString()}</div>
					<div>
						Supports Images:{" "}
						{details.supportsImages ? (
							<Check className="inline text-green-500 h-3 w-3" />
						) : (
							<X className="inline text-red-500 h-3 w-3" />
						)}
					</div>
					<div>
						Supports Prompt Cache:{" "}
						{details.supportsPromptCache ? (
							<Check className="inline text-green-500 h-3 w-3" />
						) : (
							<X className="inline text-red-500 h-3 w-3" />
						)}
					</div>
				</div>
				<div className="space-y-1">
					<div>Input Price: ${details.inputPrice} per million tokens</div>
					<div>Output Price: ${details.outputPrice} per million tokens</div>
					{details?.cacheWritesPrice && (
						<div>Cache Writes: ${details.cacheWritesPrice} per million tokens</div>
					)}
					{details.cacheReadsPrice && <div>Cache Reads: ${details.cacheReadsPrice} per million tokens</div>}
				</div>
				<div className="flex flex-wrap gap-1 mt-2">
					{details.isRecommended && (
						<span className="px-1 py-0.5 bg-secondary text-secondary-foreground text-[10px] rounded-full">
							Recommended
						</span>
					)}
					{details.isHardWorker && (
						<span className="px-1 py-0.5 bg-secondary text-secondary-foreground text-[10px] rounded-full">
							Hard Worker
						</span>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
})

const ExperimentalFeatureItem: React.FC<{
	feature: ExperimentalFeature
	checked: boolean
	onCheckedChange: (checked: boolean) => void
}> = React.memo(({ feature, checked, onCheckedChange }) => (
	<div className="flex items-center justify-between">
		<div className="flex-1 pr-2">
			<Label htmlFor={feature.id} className="text-xs font-medium flex items-center">
				{feature.label}
			</Label>
			<p className="text-[10px] text-muted-foreground">{feature.description}</p>
		</div>
		{feature.comingSoon ? (
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="ml-1 text-[10px] bg-secondary text-secondary-foreground px-1 py-0.5 rounded cursor-pointer">
						BETA
					</span>
				</TooltipTrigger>
				<TooltipContent align="end">
					<div className="max-w-[80vw] w-full">
						<pre className="whitespace-pre-line">
							This feature is currently in closed beta, if you would like to participate please contact us
							via discord.
						</pre>
					</div>
				</TooltipContent>
			</Tooltip>
		) : (
			<Switch id={feature.id} checked={checked} onCheckedChange={onCheckedChange} disabled={feature.disabled} />
		)}
	</div>
))

const SettingsPage: React.FC = () => {
	const extensionState = useExtensionState()
	const [model, setModel] = useState(extensionState.apiConfiguration?.apiModelId || "claude-3-5-sonnet-20240620")
	const [technicalLevel, setTechnicalLevel] = useState(extensionState.technicalBackground)
	const [readOnly, setReadOnly] = useState(extensionState.alwaysAllowReadOnly || false)
	const [autoCloseTerminal, setAutoCloseTerminal] = useState(extensionState.autoCloseTerminal || false)
	const [experimentalFeatureStates, setExperimentalFeatureStates] = useState({
		alwaysAllowWriteOnly: extensionState.alwaysAllowWriteOnly || false,
		"one-click-deployment": false,
		"auto-summarize-chat": false,
	})
	const [customInstructions, setCustomInstructions] = useState(extensionState.customInstructions || "")

	const handleExperimentalFeatureChange = useCallback(
		(featureId: keyof GlobalState, checked: boolean) => {
			setExperimentalFeatureStates((prev) => {
				const newState = { ...prev, [featureId]: checked }
				if (featureId === "alwaysAllowWriteOnly") {
					extensionState.setAlwaysAllowWriteOnly(checked)
					vscode.postMessage({ type: "alwaysAllowWriteOnly", bool: checked })
				}
				return newState
			})
		},
		[extensionState]
	)

	const handleTechnicalLevelChange = useCallback((setLevel: typeof technicalLevel) => {
		console.log(`Setting technical level to: ${setLevel}`)
		setTechnicalLevel(setLevel!)
		vscode.postMessage({ type: "technicalBackground", value: setLevel! })
	}, [])

	const handleModelChange = useCallback((newModel: typeof model) => {
		setModel(newModel!)
		vscode.postMessage({ type: "apiConfiguration", apiConfiguration: { apiModelId: newModel } })
	}, [])

	const handleSetReadOnly = useCallback((checked: boolean) => {
		setReadOnly(checked)
		vscode.postMessage({ type: "alwaysAllowReadOnly", bool: checked })
	}, [])

	const handleSetAutoCloseTerminal = useCallback((checked: boolean) => {
		setAutoCloseTerminal(checked)
		vscode.postMessage({ type: "autoCloseTerminal", bool: checked })
	}, [])

	useDebounce(customInstructions, 250, (val) => {
		if (val === extensionState.customInstructions) return
		extensionState.setCustomInstructions(val)
		vscode.postMessage({ type: "customInstructions", text: val })
	})

	return (
		<div className="container mx-auto px-4 max-[280px]:px-2 py-4 max-w-[500px]">
			<h1 className="text-xl font-bold mb-2">Settings</h1>
			<p className="text-xs text-muted-foreground mb-4">Manage your extension preferences</p>

			<div className="mb-4 space-y-3">
				<div className="flex max-[280px]:items-start max-[280px]:flex-col max-[280px]:space-y-2 flex-row justify-between items-center">
					<div>
						<p className="text-xs font-medium">Signed in as</p>
						<p className="text-sm font-bold">{extensionState.user?.email}</p>
					</div>
					<div className="max-[280px]:mt-2">
						<p className="text-xs font-medium">Credits remaining</p>
						<p className="text-lg font-bold">{formatPrice(extensionState.user?.credits || 0)}</p>
					</div>
				</div>
				<div className="flex gap-2 flex-wrap">
					<Button
						onClick={() => {
							vscode.postTrackingEvent("ExtensionCreditAddOpen")
							vscode.postTrackingEvent("ExtensionCreditAddSelect", "purchase")
						}}
						asChild>
						<a href={getKoduAddCreditsUrl(extensionState.uriScheme)}>Add Credits</a>
					</Button>
					<Tooltip>
						<TooltipTrigger>
							<Button
								onClick={() => {
									vscode.postTrackingEvent("OfferwallView")
									vscode.postTrackingEvent("ExtensionCreditAddSelect", "offerwall")
								}}
								variant={"outline"}
								asChild>
								<a href={getKoduOfferUrl(extensionState.uriScheme)}>Offerwall</a>
							</Button>
						</TooltipTrigger>
						<TooltipContent align="end">Earn up to $10 extra credits for free!</TooltipContent>
					</Tooltip>
				</div>
			</div>

			<Tabs defaultValue="preferences" className="space-y-4">
				<TabsList className="w-full grid grid-cols-3 gap-1 max-[280px]:grid-cols-1 h-full">
					<TabsTrigger value="preferences" className="text-xs py-1 px-2 h-auto">
						Preferences
					</TabsTrigger>
					<TabsTrigger value="experimental" className="text-xs py-1 px-2 h-auto">
						Experimental
					</TabsTrigger>
					<TabsTrigger value="advanced" className="text-xs py-1 px-2 h-auto">
						Advanced
					</TabsTrigger>
				</TabsList>

				<TabsContent value="preferences" className="space-y-4">
					<div className="space-y-2">
						<Label className="text-sm">Technical Level</Label>
						<RadioGroup
							value={technicalLevel}
							// @ts-expect-error can't be stricly typed
							onValueChange={handleTechnicalLevelChange}
							className="space-y-1">
							<div className="flex items-center space-x-2">
								<RadioGroupItem value="no-technical" id="no-technical" />
								<Label htmlFor="no-technical" className="text-xs">
									Non Technical
								</Label>
							</div>
							{/* technical developer */}
							<div className="flex items-center space-x-2">
								<RadioGroupItem value="technical" id="technical" />
								<Label htmlFor="technical" className="text-xs">
									Coding Beginner
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<RadioGroupItem value="developer" id="developer" />
								<Label htmlFor="developer" className="text-xs">
									Experienced Developer
								</Label>
							</div>
						</RadioGroup>
					</div>
					<div className="space-y-2">
						<Label htmlFor="model-select" className="text-sm">
							AI Model
						</Label>
						<Select value={model} onValueChange={handleModelChange}>
							<SelectTrigger id="model-select" className="w-full text-xs">
								<SelectValue placeholder="Select a model" />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(models).map(([key, value]) => (
									<SelectItem key={key} value={key} disabled={value.disabled} className="text-xs">
										{value.label} {value.comingSoon && "(Coming Soon)"}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<ModelDetails model={model} />
					</div>
				</TabsContent>

				<TabsContent value="experimental" className="space-y-4">
					{experimentalFeatures.map((feature) => (
						<ExperimentalFeatureItem
							key={feature.id}
							feature={feature}
							// @ts-expect-error can't be stricly typed as we put unused keys (BETA features)
							checked={experimentalFeatureStates[feature.id]}
							onCheckedChange={(checked) => handleExperimentalFeatureChange(feature.id, checked)}
						/>
					))}
				</TabsContent>

				<TabsContent value="advanced" className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex-1 pr-2">
							<Label htmlFor="read-only" className="text-xs font-medium">
								Always Allow Read-Only Operations
							</Label>
							<p className="text-[10px] text-muted-foreground">
								Automatically read files and view directories without requiring permission
							</p>
						</div>
						<Switch id="read-only" checked={readOnly} onCheckedChange={handleSetReadOnly} />
					</div>
					<div className="flex items-center justify-between">
						<div className="flex-1 pr-2">
							<Label htmlFor="auto-close" className="text-xs font-medium">
								Automatically close terminal
							</Label>
							<p className="text-[10px] text-muted-foreground">
								Automatically close the terminal after executing a command
							</p>
						</div>
						<Switch
							id="auto-close"
							checked={autoCloseTerminal}
							onCheckedChange={handleSetAutoCloseTerminal}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="custom-instructions" className="text-xs font-medium">
							Custom Instructions
						</Label>
						<Textarea
							id="custom-instructions"
							placeholder="e.g. 'Run unit tests at the end', 'Use TypeScript with async/await'"
							value={customInstructions}
							onChange={(e) => {
								setCustomInstructions(e.target.value)
							}}
							className="min-h-[60px] text-xs"
						/>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	)
}

export default SettingsPage
