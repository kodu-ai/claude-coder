import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { showSettingsAtom, useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { formatPrice } from "../ApiOptions/utils"
import { getKoduAddCreditsUrl, getKoduOfferUrl, getKoduSignInUrl } from "../../../../src/shared/kodu"
import { SettingsFooter } from "./settings-footer"
import { experimentalFeatures, models } from "./constants"
import { useSettingsState } from "../../hooks/useSettingsState"
import { ModelDetails } from "./model-details"
import { ExperimentalFeatureItem } from "./experimental-feature-item"
import { useSetAtom } from "jotai"
import { X } from "lucide-react"

export const UserInfoSection: React.FC = () => {
	const extensionState = useExtensionState()

	if (extensionState.user === undefined) {
		return (
			<Button
				onClick={() => {
					vscode.postTrackingEvent("AuthStart")
				}}
				asChild>
				<a href={getKoduSignInUrl(extensionState.uriScheme, extensionState.extensionName)}>Sign in to Kodu</a>
			</Button>
		)
	}

	return (
		<>
			<div className="flex max-[280px]:items-start max-[280px]:flex-col max-[280px]:space-y-2 flex-row justify-between items-center">
				<div>
					<p className="text-xs font-medium">Signed in as</p>
					<p className="text-sm font-bold">{extensionState.user?.email}</p>
					<Button
						variant="link"
						size="sm"
						className="text-sm !text-muted-foreground"
						onClick={() => vscode.postMessage({ type: "didClickKoduSignOut" })}>
						sign out
					</Button>
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
				<Button
					onClick={() => {
						vscode.postTrackingEvent("OfferwallView")
						vscode.postTrackingEvent("ExtensionCreditAddSelect", "offerwall")
					}}
					variant={"outline"}
					asChild>
					<a href={getKoduOfferUrl(extensionState.uriScheme)}>Get Free Credits</a>
				</Button>
			</div>
		</>
	)
}

export const PreferencesTab: React.FC = () => {
	const { model, technicalLevel, handleModelChange, handleTechnicalLevelChange } = useSettingsState()

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label className="text-sm">Technical Level</Label>
				<RadioGroup
					value={technicalLevel}
					onValueChange={(v) => handleTechnicalLevelChange(v as typeof technicalLevel)}
					className="space-y-1">
					<div className="flex items-center space-x-2">
						<RadioGroupItem value="no-technical" id="no-technical" />
						<Label htmlFor="no-technical" className="text-xs">
							Non Technical
						</Label>
					</div>
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
					<SelectTrigger id="model-select" className="w-full">
						<SelectValue placeholder="Select a model" />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(models).map(([key, value]) => (
							<SelectItem key={key} value={key} disabled={value.disabled}>
								{value.label} {value.comingSoon && "(Coming Soon)"}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<ModelDetails model={model} />
			</div>
		</div>
	)
}

export const ExperimentalTab: React.FC = () => {
	const { experimentalFeatureStates, handleExperimentalFeatureChange } = useSettingsState()

	return (
		<div className="space-y-4">
			{experimentalFeatures.map((feature) => (
				<ExperimentalFeatureItem
					key={feature.id}
					feature={feature}
					checked={experimentalFeatureStates[feature.id as keyof typeof experimentalFeatureStates]}
					onCheckedChange={(checked) => handleExperimentalFeatureChange(feature.id, checked)}
				/>
			))}
		</div>
	)
}

const ClosePageButton: React.FC = () => {
	const setIsOpen = useSetAtom(showSettingsAtom)
	return (
		<Button variant="ghost" size="icon" className="ml-auto" onClick={() => setIsOpen(false)}>
			<X className="size-4" />
		</Button>
	)
}

const AdvancedTab: React.FC = () => {
	const {
		readOnly,
		autoCloseTerminal,
		autoSkipWrite,
		customInstructions,
		handleSetReadOnly,
		handleSetAutoCloseTerminal,
		handleAutoSkipWriteChange,
		setCustomInstructions,
	} = useSettingsState()

	return (
		<div className="space-y-4">
			<ExperimentalFeatureItem
				feature={{
					id: "alwaysAllowReadOnly",
					label: "Always Allow Read-Only Operations",
					description: "Automatically read files and view directories without requiring permission",
				}}
				checked={readOnly}
				onCheckedChange={handleSetReadOnly}
			/>
			<ExperimentalFeatureItem
				feature={{
					id: "autoCloseTerminal",
					label: "Automatically close terminal",
					description: "Automatically close the terminal after executing a command",
				}}
				checked={autoCloseTerminal}
				onCheckedChange={handleSetAutoCloseTerminal}
			/>
			<ExperimentalFeatureItem
				feature={{
					id: "skipWriteAnimation",
					label: "Automatically skip file write animation",
					description:
						"Automatically skip the file write animation when saving files *good for low-end machines*",
				}}
				checked={autoSkipWrite}
				onCheckedChange={handleAutoSkipWriteChange}
			/>
			<div className="space-y-1">
				<Label htmlFor="custom-instructions" className="text-xs font-medium">
					Custom Instructions
				</Label>
				<Textarea
					id="custom-instructions"
					placeholder="e.g. 'Run unit tests at the end', 'Use TypeScript with async/await'"
					value={customInstructions}
					onChange={(e) => setCustomInstructions(e.target.value)}
					className="min-h-[60px] text-xs"
				/>
			</div>
		</div>
	)
}

const SettingsPage: React.FC = () => {
	return (
		<div className="container mx-auto px-4 max-[280px]:px-2 py-4 max-w-[500px] flex flex-col h-full">
			<div className="flex items-center">
				<h1 className="text-xl font-bold mb-2">Settings</h1>

				<ClosePageButton />
			</div>
			<p className="text-xs text-muted-foreground mb-4">Manage your extension preferences</p>

			<div className="mb-4 space-y-3">
				<UserInfoSection />
			</div>

			<Tabs defaultValue="preferences" className="space-y-4">
				<TabsList className="w-full grid grid-cols-3 gap-1 max-[280px]:grid-cols-1 h-fit">
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

				<TabsContent value="preferences">
					<PreferencesTab />
				</TabsContent>

				<TabsContent value="experimental">
					<ExperimentalTab />
				</TabsContent>

				<TabsContent value="advanced">
					<AdvancedTab />
				</TabsContent>
			</Tabs>

			<div className="mt-auto mb-2 flex w-full">
				<SettingsFooter />
			</div>
		</div>
	)
}

export default SettingsPage
