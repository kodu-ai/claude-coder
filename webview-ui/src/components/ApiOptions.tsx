import { VSCodeButton, VSCodeDropdown, VSCodeLink, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useEvent } from "react-use"
import { ApiModelId, ModelInfo, koduDefaultModelId, koduModels } from "../../../src/shared/api"
import { ExtensionMessage } from "../../../src/shared/ExtensionMessage"
import { getKoduAddCreditsUrl, getKoduHomepageUrl, getKoduReferUrl, getKoduSignInUrl } from "../../../src/shared/kodu"
import { vscode } from "../utils/vscode"
import VSCodeButtonLink from "./VSCodeButtonLink"
import { useExtensionState } from "../context/ExtensionStateContext"
import { ApiConfiguration } from "../../../src/api"

interface ApiOptionsProps {
	showModelOptions: boolean

	setDidAuthKodu?: React.Dispatch<React.SetStateAction<boolean>>
}

const ApiOptions: React.FC<ApiOptionsProps> = ({ showModelOptions, setDidAuthKodu }) => {
	const { apiConfiguration, setApiConfiguration, user, uriScheme } = useExtensionState()
	const [, setDidFetchKoduCredits] = useState(false)
	const handleInputChange = (field: keyof ApiConfiguration) => (event: any) => {
		setApiConfiguration({ ...apiConfiguration, [field]: event.target.value })
	}

	const { selectedProvider, selectedModelId, selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	/*
	VSCodeDropdown has an open bug where dynamically rendered options don't auto select the provided value prop. You can see this for yourself by comparing  it with normal select/option elements, which work as expected.
	https://github.com/microsoft/vscode-webview-ui-toolkit/issues/433

	In our case, when the user switches between providers, we recalculate the selectedModelId depending on the provider, the default model for that provider, and a modelId that the user may have selected. Unfortunately, the VSCodeDropdown component wouldn't select this calculated value, and would default to the first "Select a model..." option instead, which makes it seem like the model was cleared out when it wasn't. 

	As a workaround, we create separate instances of the dropdown for each provider, and then conditionally render the one that matches the current provider.
	*/
	const createDropdown = (models: Record<string, ModelInfo>) => {
		return (
			<VSCodeDropdown
				id="model-id"
				value={selectedModelId}
				onChange={handleInputChange("apiModelId")}
				style={{ width: "100%" }}>
				<VSCodeOption value="">Select a model...</VSCodeOption>
				{Object.keys(models).map((modelId) => (
					<VSCodeOption
						key={modelId}
						value={modelId}
						style={{
							whiteSpace: "normal",
							wordWrap: "break-word",
							maxWidth: "100%",
						}}>
						{modelId}
					</VSCodeOption>
				))}
			</VSCodeDropdown>
		)
	}

	useEffect(() => {
		console.log(`user`, user)
		if (user === undefined) {
			setDidFetchKoduCredits(false)
			vscode.postMessage({ type: "fetchKoduCredits" })
		}
	}, [selectedProvider, user])

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		switch (message.type) {
			case "action":
				switch (message.action) {
					case "koduCreditsFetched":
						setDidFetchKoduCredits(true)
						break
				}
				break
		}
	}, [])
	useEvent("message", handleMessage)

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
			<div>
				{user !== undefined ? (
					<>
						<div style={{ marginBottom: 5, marginTop: 3 }}>
							<span style={{ color: "var(--vscode-descriptionForeground)" }}>
								Signed in as {user?.email || "Unknown"}
							</span>{" "}
							<VSCodeLink
								style={{ display: "inline" }}
								onClick={() => vscode.postMessage({ type: "didClickKoduSignOut" })}>
								(sign out?)
							</VSCodeLink>
						</div>
						<div style={{ marginBottom: 7 }}>
							Credits remaining:{" "}
							<span style={{ fontWeight: 500, opacity: user !== undefined ? 1 : 0.6 }}>
								{formatPrice(user?.credits || 0)}
							</span>
						</div>
						<div
							style={{
								display: "flex",
								flexWrap: "wrap",
								gap: 10,
								marginBottom: 5,
							}}>
							<VSCodeButton
								disabled
								style={{
									width: "fit-content",
									marginRight: 10,
								}}>
								Referral Program
							</VSCodeButton>
							<VSCodeButtonLink
								href={getKoduAddCreditsUrl(uriScheme)}
								style={{
									width: "fit-content",
								}}>
								Add Credits
							</VSCodeButtonLink>
						</div>
					</>
				) : (
					<div style={{ margin: "4px 0px" }}>
						<VSCodeButtonLink href={getKoduSignInUrl(uriScheme)} onClick={() => setDidAuthKodu?.(true)}>
							Sign in to Kodu
						</VSCodeButtonLink>
					</div>
				)}
				<p
					style={{
						fontSize: 12,
						marginTop: 6,
						color: "var(--vscode-descriptionForeground)",
					}}>
					Kodu is recommended for its high rate limits and access to the latest features like prompt caching.
					<VSCodeLink href={getKoduHomepageUrl()} style={{ display: "inline", fontSize: "12px" }}>
						Learn more about Kodu here.
					</VSCodeLink>
				</p>
			</div>

			{showModelOptions && (
				<>
					<div className="dropdown-container">
						<label htmlFor="model-id">
							<span style={{ fontWeight: 500 }}>Model</span>
						</label>
						{selectedProvider === "kodu" && createDropdown(koduModels)}
					</div>

					<ModelInfoView modelInfo={selectedModelInfo} />
				</>
			)}
		</div>
	)
}

export const formatPrice = (price: number) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(price)
}

const ModelInfoView = ({ modelInfo }: { modelInfo: ModelInfo }) => {
	return (
		<p style={{ fontSize: "12px", marginTop: "2px", color: "var(--vscode-descriptionForeground)" }}>
			<ModelInfoSupportsItem
				isSupported={modelInfo.supportsImages}
				supportsLabel="Supports images"
				doesNotSupportLabel="Does not support images"
			/>
			<br />
			<ModelInfoSupportsItem
				isSupported={modelInfo.supportsPromptCache}
				supportsLabel="Supports prompt caching"
				doesNotSupportLabel="Does not support prompt caching"
			/>
			<br />
			<ModelInfoSupportsItem
				isSupported={true}
				supportsLabel="Experimental Rewrite Mode"
				doesNotSupportLabel="Does not support Rewrite Mode"
			/>
			<br />
			<span style={{ fontWeight: 500 }}>Max output:</span> {modelInfo?.maxTokens?.toLocaleString()} tokens
			<br />
			<span style={{ fontWeight: 500 }}>Input price:</span> {formatPrice(modelInfo.inputPrice)}/million tokens
			{modelInfo.supportsPromptCache && modelInfo.cacheWritesPrice && modelInfo.cacheReadsPrice && (
				<>
					<br />
					<span style={{ fontWeight: 500 }}>Cache writes price:</span>{" "}
					{formatPrice(modelInfo.cacheWritesPrice || 0)}/million tokens
					<br />
					<span style={{ fontWeight: 500 }}>Cache reads price:</span>{" "}
					{formatPrice(modelInfo.cacheReadsPrice || 0)}/million tokens
				</>
			)}
			<br />
			<span style={{ fontWeight: 500 }}>Output price:</span> {formatPrice(modelInfo.outputPrice)}/million tokens
		</p>
	)
}

const ModelInfoSupportsItem = ({
	isSupported,
	supportsLabel,
	doesNotSupportLabel,
}: {
	isSupported: boolean
	supportsLabel: string
	doesNotSupportLabel: string
}) => (
	<span
		style={{
			fontWeight: 500,
			color: isSupported ? "var(--vscode-testing-iconPassed)" : "var(--vscode-errorForeground)",
		}}>
		<i
			className={`codicon codicon-${isSupported ? "check" : "x"}`}
			style={{
				marginRight: 4,
				marginBottom: isSupported ? 1 : -1,
				fontSize: isSupported ? 11 : 13,
				fontWeight: 700,
				display: "inline-block",
				verticalAlign: "bottom",
			}}></i>
		{isSupported ? supportsLabel : doesNotSupportLabel}
	</span>
)

export function normalizeApiConfiguration(apiConfiguration?: ApiConfiguration) {
	const modelId = apiConfiguration?.apiModelId

	const getProviderData = (models: Record<string, ModelInfo>, defaultId: ApiModelId) => {
		let selectedModelId: ApiModelId
		let selectedModelInfo: ModelInfo
		if (modelId && modelId in models) {
			selectedModelId = modelId
			selectedModelInfo = models[modelId]
		} else {
			selectedModelId = defaultId
			selectedModelInfo = models[defaultId]
		}
		return { selectedProvider: "kodu", selectedModelId, selectedModelInfo }
	}

	return getProviderData(koduModels, koduDefaultModelId)
}

export default ApiOptions
