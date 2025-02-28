import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ModelSelector } from "../preferences/model-picker"
import { ChevronDown } from "lucide-react"
import { rpcClient } from "@/lib/rpc-client"
import { useSwitchToProviderManager } from "../preferences/atoms"

export const ObserverAgentCard = () => {
	const { data, refetch } = rpcClient.getObserverSettings.useQuery(
		{},
		{
			refetchInterval: 5000,
			refetchOnWindowFocus: true,
			refetchIntervalInBackground: true,
		}
	)
	const switchToProvider = useSwitchToProviderManager()

	const { mutate: customizeObserverPrompt, isPending: customizeObserverPromptPending } =
		rpcClient.customizeObserverPrompt.useMutation({})
	const { data: modelListData } = rpcClient.listModels.useQuery(
		{},
		{
			refetchInterval: 5000,
			refetchOnWindowFocus: true,
		}
	)

	const observerEnabled = !!data?.observerSettings
	const observerSettings = data?.observerSettings
	const {
		data: currentModelInfo,
		status: modelStatus,
		refetch: refetchModelData,
	} = rpcClient.currentObserverModel.useQuery(
		{},
		{
			refetchInterval: 5000,
			refetchOnMount: true,
			refetchOnWindowFocus: true,
		}
	)
	const { mutate: setObserverEnabled } = rpcClient.enableObserverAgent.useMutation({
		onSuccess: () => {
			refetch()
		},
	})

	const { mutate: updateSettings } = rpcClient.updateObserverAgent.useMutation({
		onSuccess: () => {
			refetch()
		},
	})

	const { mutate: selectModel } = rpcClient.selectObserverModel.useMutation({
		onSuccess: () => {
			refetch()
			refetchModelData()
		},
	})

	const handleFrequencyChange = (value: number) => {
		if (observerSettings) {
			updateSettings({
				observeEveryXRequests: value,
			})
		}
	}

	const handlePullMessagesChange = (value: number) => {
		if (observerSettings) {
			updateSettings({
				observePullMessages: value,
			})
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm">Observer Agent</CardTitle>
					<Switch
						checked={observerEnabled}
						onCheckedChange={(e) => setObserverEnabled({ enabled: e })}
						aria-label="Toggle observer agent"
					/>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<CardDescription className="text-xs">
					An intelligent observer that monitors Kodu's actions in real-time, providing feedback and insights
					to help optimize performance. The observer analyzes patterns, suggests improvements, and helps
					maintain alignment with your goals through continuous evaluation and feedback.
				</CardDescription>
				{observerEnabled && observerSettings && (
					<div className="flex flex-col gap-4">
						<div className="space-y-2">
							<Label className="text-xs">Observer Frequency (requests)</Label>
							<div className="text-xs text-muted-foreground mb-2">
								How often the observer agent should analyze Kodu's actions. Lower values mean more
								frequent observations but may impact performance.
							</div>
							<Slider
								value={[observerSettings.observeEveryXRequests]}
								onValueChange={(value) => handleFrequencyChange(value[0])}
								min={1}
								max={10}
								step={1}
								className="w-full"
							/>
							<div className="text-xs text-muted-foreground">
								Current: Every {observerSettings.observeEveryXRequests} request
								{observerSettings.observeEveryXRequests > 1 ? "s" : ""}
							</div>
						</div>
						<div className="space-y-2">
							<Label className="text-xs">Messages to Analyze</Label>
							<div className="text-xs text-muted-foreground mb-2">
								Number of previous messages the observer will review for context. More messages provide
								better context but may increase processing time.
							</div>
							<Slider
								value={[observerSettings.observePullMessages]}
								onValueChange={(value) => handlePullMessagesChange(value[0])}
								min={1}
								max={20}
								step={1}
								className="w-full"
							/>
							<div className="text-xs text-muted-foreground">
								Current: {observerSettings.observePullMessages} message
								{observerSettings.observePullMessages > 1 ? "s" : ""}
							</div>
						</div>
						<div className="space-y-2">
							<Label className="text-xs">Select Observer Model</Label>
							<div className="text-xs text-muted-foreground mb-2">
								The AI model that will analyze Kodu's actions. Different models may offer varying levels
								of insight and performance.
							</div>
							<ModelSelector
								models={modelListData?.models ?? []}
								modelId={observerSettings.modelId ?? null}
								providerId={observerSettings.providerId ?? null}
								onChangeModel={selectModel}
								showDetails={false}>
								<Button
									variant="ghost"
									className="text-xs flex items-center gap-1 h-6 px-2 hover:bg-accent">
									{modelListData?.models.find((m) => m.id === observerSettings.modelId)?.name ||
										"Select Model"}
									<ChevronDown className="w-4 h-4" />
								</Button>
							</ModelSelector>
							{data.observerSettings?.providerId &&
								data.observerSettings?.providerId !== "kodu" &&
								!currentModelInfo?.providerData.currentProvider && (
									<span
										onClick={() => {
											switchToProvider(data.observerSettings?.providerId!)
										}}
										className="text-destructive text-[11px] hover:underline cursor-pointer">
										Requires setting up a provider key. Click here to set up a provider.
									</span>
								)}
						</div>
						<div className="space-y-2 mb-4">
							<Label className="text-xs">Custom Prompt</Label>
							<div className="text-xs text-muted-foreground mb-2">
								Customize the observer's prompt to provide special instructions or context for the
								model.
							</div>
							<div className="flex flex-row gap-2 items-center flex-wrap">
								<Button
									disabled={customizeObserverPromptPending}
									onClick={() => {
										customizeObserverPrompt({})
									}}
									variant="default"
									size="sm"
									className="text-xs w-auto">
									Edit Prompt
								</Button>
								{observerSettings.observePrompt && (
									<Button
										variant="destructive"
										className="text-xs w-auto"
										size="sm"
										onClick={() => updateSettings({ clearPrompt: true })}>
										Clear Prompt
									</Button>
								)}
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
