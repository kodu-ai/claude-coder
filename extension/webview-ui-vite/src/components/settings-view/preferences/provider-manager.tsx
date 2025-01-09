import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
	ProviderSettings,
	ProviderType,
	GoogleVertexSettings,
	AmazonBedrockSettings,
} from "../../../../../src/api/providers/types"
import { customProvidersConfigs as providers } from "../../../../../src/api/providers/config/index"
import { rpcClient } from "@/lib/rpc-client"
import { useAtom } from "jotai"
import { createDefaultSettings, providerSettingsAtom } from "./atoms"

const ProviderManager: React.FC = () => {
	const [providerSettings, setProviderSettings] = useAtom(providerSettingsAtom)
	const [error, setError] = useState<string>("")

	// Query existing providers
	const { data: providersData, refetch } = rpcClient.listProviders.useQuery({})

	// Mutations for creating and updating providers
	const { mutate: createProvider } = rpcClient.createProvider.useMutation({
		onSuccess: () => {
			refetch()
		},
	})
	const { mutate: updateProvider } = rpcClient.updateProvider.useMutation({
		onSuccess: () => {
			refetch()
		},
	})

	const { mutate: deleteProvider } = rpcClient.deleteProvider.useMutation({
		onSuccess: () => {
			refetch()
		},
	})

	const handleProviderChange = (providerId: ProviderType) => {
		const existingProvider = providersData?.providers?.find((p) => p.providerId === providerId)
		const provider = providers[providerId]

		if (existingProvider) {
			switch (providerId) {
				case "google-vertex":
					setProviderSettings(existingProvider as GoogleVertexSettings)
					break
				case "amazon-bedrock":
					setProviderSettings(existingProvider as AmazonBedrockSettings)
					break
				default:
					setProviderSettings(existingProvider as ProviderSettings)
			}
		} else if (provider) {
			setProviderSettings(createDefaultSettings(providerId))
		}
	}

	const saveSettings = (settings: ProviderSettings) => {
		try {
			const existingProvider = providersData?.providers?.find((p) => p.providerId === settings.providerId)
			console.log("existingProvider", existingProvider)
			if (existingProvider) {
				updateProvider(settings)
			} else {
				createProvider(settings)
			}
		} catch (err) {
			setError("Failed to save provider settings")
		}
	}

	const renderProviderSpecificFields = () => {
		if (!providerSettings) return null

		switch (providerSettings.providerId) {
			case "google-vertex":
				const vertexSettings = providerSettings as GoogleVertexSettings
				return (
					<>
						<div className="space-y-2">
							<Label htmlFor="clientEmail">Client Email</Label>
							<Input
								id="clientEmail"
								value={vertexSettings.clientEmail || ""}
								onChange={(e) => updateSettings("clientEmail", e.target.value)}
								className="h-8"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="privateKey">Private Key</Label>
							<Input
								id="privateKey"
								type="password"
								value={vertexSettings.privateKey || ""}
								onChange={(e) => updateSettings("privateKey", e.target.value)}
								className="h-8"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="project">Project</Label>
							<Input
								id="project"
								value={vertexSettings.project || ""}
								onChange={(e) => updateSettings("project", e.target.value)}
								className="h-8"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="location">Location</Label>
							<Input
								id="location"
								value={vertexSettings.location || ""}
								onChange={(e) => updateSettings("location", e.target.value)}
								className="h-8"
							/>
						</div>
					</>
				)

			case "amazon-bedrock":
				const bedrockSettings = providerSettings as AmazonBedrockSettings
				return (
					<>
						<div className="space-y-2">
							<Label htmlFor="region">Region</Label>
							<Input
								id="region"
								value={bedrockSettings.region || ""}
								onChange={(e) => updateSettings("region", e.target.value)}
								className="h-8"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="accessKeyId">Access Key ID</Label>
							<Input
								id="accessKeyId"
								value={bedrockSettings.accessKeyId || ""}
								onChange={(e) => updateSettings("accessKeyId", e.target.value)}
								className="h-8"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="secretAccessKey">Secret Access Key</Label>
							<Input
								id="secretAccessKey"
								type="password"
								value={bedrockSettings.secretAccessKey || ""}
								onChange={(e) => updateSettings("secretAccessKey", e.target.value)}
								className="h-8"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="sessionToken">Session Token (Optional)</Label>
							<Input
								id="sessionToken"
								value={bedrockSettings.sessionToken || ""}
								onChange={(e) => updateSettings("sessionToken", e.target.value)}
								className="h-8"
							/>
						</div>
					</>
				)

			// Add other provider-specific fields here
			default:
				const settings = providerSettings as any
				return (
					<div className="space-y-2">
						<Label htmlFor="apiKey">API Key</Label>
						<Input
							id="apiKey"
							type="password"
							value={settings.apiKey || ""}
							onChange={(e) => updateSettings("apiKey", e.target.value)}
							className="h-8"
						/>
					</div>
				)
		}
	}

	const updateSettings = (field: string, value: string) => {
		if (!providerSettings) return

		setProviderSettings({
			...providerSettings,
			[field]: value,
		})
	}

	const currentProvider = providersData?.providers.find((p) => p.providerId === providerSettings?.providerId)

	return (
		<Card className="bg-background border-border">
			<CardContent className="p-6">
				<div className="space-y-4">
					<h2 className="text-xl font-semibold">Provider Settings</h2>

					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="providerId">Provider</Label>
							<Select
								value={providerSettings?.providerId || ""}
								onValueChange={(value: ProviderType) => handleProviderChange(value)}>
								<SelectTrigger className="h-8">
									<SelectValue placeholder="Select provider" />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(providers).map(([id, config]) => {
										const isConfigured = providersData?.providers?.some((p) => p.providerId === id)
										return (
											<SelectItem key={id} value={id}>
												<div className="flex items-center gap-2">
													{config.name}
													{isConfigured && <span className="text-green-500 text-sm">✓</span>}
												</div>
											</SelectItem>
										)
									})}
								</SelectContent>
							</Select>
						</div>

						{renderProviderSpecificFields()}

						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<Button
							onClick={() => providerSettings && saveSettings(providerSettings)}
							className="w-full h-9">
							Save Settings
						</Button>
						{
							// Show delete button if provider is already configured
							currentProvider && (
								<Button
									variant="destructive"
									onClick={() => {
										if (currentProvider.providerId) {
											setProviderSettings(null)
											setError("")
											deleteProvider({ id: currentProvider.providerId! })
										}
									}}
									className="w-full h-9">
									Delete Provider
								</Button>
							)
						}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export default ProviderManager
