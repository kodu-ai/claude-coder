// import React, { useState } from "react"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { Label } from "@/components/ui/label"
// import { Button } from "@/components/ui/button"
// import { Switch } from "@/components/ui/switch"
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
// import { Textarea } from "@/components/ui/textarea"
// import { Input } from "@/components/ui/input"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Check, X, ChevronDown, Lock } from "lucide-react"
// import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"

// const anthropicModels = {
// 	"claude-3-5-sonnet-20240620": {
// 		label: "Claude 3.5 Sonnet",
// 		maxTokens: 8192,
// 		contextWindow: 200_000,
// 		supportsImages: true,
// 		supportsPromptCache: true,
// 		inputPrice: 3.0,
// 		outputPrice: 15.0,
// 		cacheWritesPrice: 3.75,
// 		cacheReadsPrice: 0.3,
// 		isRecommended: true,
// 		isHardWorker: true,
// 	},
// 	"claude-3-opus-20240229": {
// 		label: "Claude 3 Opus",
// 		maxTokens: 4096,
// 		contextWindow: 200_000,
// 		supportsImages: true,
// 		supportsPromptCache: true,
// 		inputPrice: 15.0,
// 		outputPrice: 75.0,
// 		cacheWritesPrice: 18.75,
// 		cacheReadsPrice: 1.5,
// 	},
// 	"claude-4-coming-soon": {
// 		label: "Claude 4",
// 		disabled: true,
// 		comingSoon: true,
// 	},
// }

// const experimentalFeatures = [
// 	{
// 		id: "auto-mode",
// 		label: "Automatic Mode",
// 		description: "Claude will automatically try to solve tasks without asking for permission",
// 	},
// 	{
// 		id: "experimental-shell",
// 		label: "Experimental Terminal Shell",
// 		description: "Enable Claude to run shell commands in the terminal directly",
// 	},
// 	{
// 		id: "one-click-deployment",
// 		label: "One Click Deployment",
// 		description: "Deploy your projects with a single click",
// 		disabled: true,
// 		comingSoon: true,
// 	},
// 	{
// 		id: "auto-summarize-chat",
// 		label: "AutoSummarize Chat",
// 		description: "Automatically generate summaries of your chat conversations",
// 		disabled: true,
// 		comingSoon: true,
// 	},
// ]

// const ModelDetails = ({ model }) => {
// 	const details = anthropicModels[model]
// 	if (!details || details.comingSoon) return null

// 	return (
// 		<Collapsible className="w-full">
// 			<CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs font-medium">
// 				Model Specifications
// 				<ChevronDown className="h-3 w-3" />
// 			</CollapsibleTrigger>
// 			<CollapsibleContent className="space-y-2 text-xs">
// 				<div className="grid grid-cols-1 gap-1">
// 					<div>Max Tokens: {details.maxTokens.toLocaleString()}</div>
// 					<div>Context Window: {details.contextWindow.toLocaleString()}</div>
// 					<div>
// 						Supports Images:{" "}
// 						{details.supportsImages ? (
// 							<Check className="inline text-green-500 h-3 w-3" />
// 						) : (
// 							<X className="inline text-red-500 h-3 w-3" />
// 						)}
// 					</div>
// 					<div>
// 						Supports Prompt Cache:{" "}
// 						{details.supportsPromptCache ? (
// 							<Check className="inline text-green-500 h-3 w-3" />
// 						) : (
// 							<X className="inline text-red-500 h-3 w-3" />
// 						)}
// 					</div>
// 				</div>
// 				<div className="space-y-1">
// 					<div>Input Price: ${details.inputPrice} per million tokens</div>
// 					<div>Output Price: ${details.outputPrice} per million tokens</div>
// 					{details.cacheWritesPrice && (
// 						<div>Cache Writes: ${details.cacheWritesPrice} per million tokens</div>
// 					)}
// 					{details.cacheReadsPrice && <div>Cache Reads: ${details.cacheReadsPrice} per million tokens</div>}
// 				</div>
// 				<div className="flex flex-wrap gap-1 mt-2">
// 					{details.isRecommended && (
// 						<span className="px-1 py-0.5 bg-secondary text-secondary-foreground text-[10px] rounded-full">
// 							Recommended
// 						</span>
// 					)}
// 					{details.isHardWorker && (
// 						<span className="px-1 py-0.5 bg-secondary text-secondary-foreground text-[10px] rounded-full">
// 							Hard Worker
// 						</span>
// 					)}
// 				</div>
// 			</CollapsibleContent>
// 		</Collapsible>
// 	)
// }

// export default function SettingsPage() {
// 	const [credits, setCredits] = useState(17.08)
// 	const [email] = useState("matanleague@gmail.com")
// 	const [model, setModel] = useState("claude-3-5-sonnet-20240620")
// 	const [technicalLevel, setTechnicalLevel] = useState("non-technical")
// 	const [readOnly, setReadOnly] = useState(true)
// 	const [experimentalFeatureStates, setExperimentalFeatureStates] = useState({
// 		"auto-mode": false,
// 		"experimental-shell": true,
// 		"one-click-deployment": false,
// 		"auto-summarize-chat": false,
// 	})
// 	const [customInstructions, setCustomInstructions] = useState("")
// 	const [maxRequests, setMaxRequests] = useState(20)

// 	const handleExperimentalFeatureChange = (featureId, checked) => {
// 		setExperimentalFeatureStates((prev) => ({ ...prev, [featureId]: checked }))
// 	}

// 	return (
// 		<div className="container mx-auto px-2 py-4 max-w-[500px]">
// 			<h1 className="text-xl font-bold mb-2">Settings</h1>
// 			<p className="text-xs text-muted-foreground mb-4">Manage your Claude preferences</p>

// 			<div className="mb-4 space-y-3">
// 				<div className="flex justify-between items-center">
// 					<div>
// 						<p className="text-xs font-medium">Signed in as</p>
// 						<p className="text-sm font-bold">{email}</p>
// 					</div>
// 					<div>
// 						<p className="text-xs font-medium">Credits remaining</p>
// 						<p className="text-lg font-bold">${credits.toFixed(2)}</p>
// 					</div>
// 				</div>
// 				<div className="flex gap-2">
// 					<Button className="text-xs py-1 px-2 h-auto">Add Credits</Button>
// 					<Button variant="outline" className="text-xs py-1 px-2 h-auto">
// 						Referral Program
// 					</Button>
// 				</div>
// 			</div>

// 			<Tabs defaultValue="preferences" className="space-y-4">
// 				<TabsList className="w-full grid grid-cols-3 gap-1">
// 					<TabsTrigger value="preferences" className="text-xs py-1 px-2 h-auto">
// 						Preferences
// 					</TabsTrigger>
// 					<TabsTrigger value="experimental" className="text-xs py-1 px-2 h-auto">
// 						Experimental
// 					</TabsTrigger>
// 					<TabsTrigger value="advanced" className="text-xs py-1 px-2 h-auto">
// 						Advanced
// 					</TabsTrigger>
// 				</TabsList>

// 				<TabsContent value="preferences" className="space-y-4">
// 					<div className="space-y-2">
// 						<Label htmlFor="model-select" className="text-sm">
// 							AI Model
// 						</Label>
// 						<Select value={model} onValueChange={setModel}>
// 							<SelectTrigger id="model-select" className="w-full text-xs">
// 								<SelectValue placeholder="Select a model" />
// 							</SelectTrigger>
// 							<SelectContent>
// 								{Object.entries(anthropicModels).map(([key, value]) => (
// 									<SelectItem key={key} value={key} disabled={value.disabled} className="text-xs">
// 										{value.label} {value.comingSoon && "(Coming Soon)"}
// 									</SelectItem>
// 								))}
// 							</SelectContent>
// 						</Select>
// 						<ModelDetails model={model} />
// 					</div>
// 					<div className="space-y-2">
// 						<Label className="text-sm">Technical Level</Label>
// 						<RadioGroup value={technicalLevel} onValueChange={setTechnicalLevel} className="space-y-1">
// 							<div className="flex items-center space-x-2">
// 								<RadioGroupItem value="non-technical" id="non-technical" />
// 								<Label htmlFor="non-technical" className="text-xs">
// 									Non Technical
// 								</Label>
// 							</div>
// 							<div className="flex items-center space-x-2">
// 								<RadioGroupItem value="coding-beginner" id="coding-beginner" />
// 								<Label htmlFor="coding-beginner" className="text-xs">
// 									Coding Beginner
// 								</Label>
// 							</div>
// 							<div className="flex items-center space-x-2">
// 								<RadioGroupItem value="experienced-developer" id="experienced-developer" />
// 								<Label htmlFor="experienced-developer" className="text-xs">
// 									Experienced Developer
// 								</Label>
// 							</div>
// 						</RadioGroup>
// 					</div>
// 				</TabsContent>

// 				<TabsContent value="experimental" className="space-y-4">
// 					{experimentalFeatures.map((feature) => (
// 						<div key={feature.id} className="flex items-center justify-between">
// 							<div className="flex-1 pr-2">
// 								<Label htmlFor={feature.id} className="text-xs font-medium flex items-center">
// 									{feature.label}
// 								</Label>
// 								<p className="text-[10px] text-muted-foreground">{feature.description}</p>
// 							</div>
// 							{feature.comingSoon ? (
// 								<Tooltip>
// 									<TooltipTrigger asChild>
// 										<span className="ml-1 text-[10px] bg-secondary text-secondary-foreground px-1 py-0.5 rounded">
// 											BETA
// 										</span>
// 									</TooltipTrigger>
// 									<TooltipContent align="end">
// 										<div className="max-w-[80vw] w-full">
// 											<pre className="whitespace-pre-line">
// 												This feature is currently in closed beta, if you would like to
// 												participate please contact us via discord.
// 											</pre>
// 										</div>
// 									</TooltipContent>
// 								</Tooltip>
// 							) : (
// 								<Switch
// 									id={feature.id}
// 									checked={experimentalFeatureStates[feature.id]}
// 									onCheckedChange={(checked) => handleExperimentalFeatureChange(feature.id, checked)}
// 									disabled={feature.disabled}
// 								/>
// 							)}
// 						</div>
// 					))}
// 				</TabsContent>

// 				<TabsContent value="advanced" className="space-y-4">
// 					<div className="flex items-center justify-between">
// 						<div className="flex-1 pr-2">
// 							<Label htmlFor="read-only" className="text-xs font-medium">
// 								Always Allow Read-Only Operations
// 							</Label>
// 							<p className="text-[10px] text-muted-foreground">
// 								Automatically read files and view directories without requiring permission
// 							</p>
// 						</div>
// 						<Switch id="read-only" checked={readOnly} onCheckedChange={setReadOnly} />
// 					</div>
// 					<div className="space-y-1">
// 						<Label htmlFor="custom-instructions" className="text-xs font-medium">
// 							Custom Instructions
// 						</Label>
// 						<Textarea
// 							id="custom-instructions"
// 							placeholder="e.g. 'Run unit tests at the end', 'Use TypeScript with async/await'"
// 							value={customInstructions}
// 							onChange={(e) => setCustomInstructions(e.target.value)}
// 							className="min-h-[60px] text-xs"
// 						/>
// 					</div>
// 					<div className="space-y-1">
// 						<Label htmlFor="max-requests" className="text-xs font-medium">
// 							Maximum # Requests Per Task
// 						</Label>
// 						<Input
// 							id="max-requests"
// 							type="number"
// 							value={maxRequests}
// 							onChange={(e) => setMaxRequests(parseInt(e.target.value))}
// 							className="text-xs"
// 						/>
// 					</div>
// 				</TabsContent>
// 			</Tabs>

// 			<div className="flex justify-end space-x-2 mt-4">
// 				<Button variant="outline" className="text-xs py-1 px-2 h-auto">
// 					Cancel
// 				</Button>
// 				<Button className="text-xs py-1 px-2 h-auto">Save Changes</Button>
// 			</div>
// 		</div>
// 	)
// }
