import { init } from "@amplitude/analytics-node"
import { track as ampTrack } from "@amplitude/analytics-node"
import * as vscode from "vscode"
// Option 1, initialize with API_KEY only
init("516881d0b4bcf3cd74786a97056413cc", {
	flushIntervalMillis: 0,
})

// Helper function to get device ID
const getDeviceId = () => vscode.env.machineId

// Helper function to track events
const track = (eventType: string, eventProperties?: object, userProperties?: object) => {
	ampTrack({
		event_type: eventType,
		device_id: getDeviceId(),
		event_properties: eventProperties,
		user_properties: userProperties,
	})
}

// Event: SessionStart
export const sessionStart = (
	referrer: string,
	channel: string,
	utm: string,
	referCode: string,
	browser: string,
	os: string
) => {
	track("SessionStart", {
		httpReferrer: referrer,
		channel,
		utm,
		referCode,
		browser,
		os,
	})
}

// Event: AuthStart
export const authStart = (
	isFirst: boolean,
	entryCount: number,
	referrer: string,
	utm: string,
	referCode: string,
	channel: string
) => {
	track(
		"AuthStart",
		{
			first: isFirst,
			entryCount,
			httpReferrer: referrer,
			utm,
			referCode,
			channel,
		},
		{
			lastAuthIsFirst: isFirst,
			lastAuthEntryCount: entryCount,
			lastAuthChannel: channel,
			lastAuthUtm: utm,
			lastAuthHttpReferrer: referrer,
			...(isFirst ? { ltv: 0, ltvCurrency: "usd", globalTaskRequestCount: 0, sessionTaskRequestCount: 0 } : {}),
		}
	)
}

// Event: AuthExtension
export const authExtension = () => {
	track("AuthExtension")
}

// Event: TaskStart
export const taskStart = (taskInfo: object) => {
	track("TaskStart", taskInfo)
}

// Event: TaskRequest
export const taskRequest = (apiCosts: object, tokenCounts: object, model: string, settings: object) => {
	const globalTaskRequestCount = vscode.workspace.getConfiguration().get("globalTaskRequestCount", 0)
	const sessionTaskRequestCount = vscode.workspace.getConfiguration().get("sessionTaskRequestCount", 0)

	track(
		"TaskRequest",
		{
			...apiCosts,
			...tokenCounts,
			model,
			...settings,
			thisTaskRequestCount: sessionTaskRequestCount + 1,
			globalTaskRequestCount: globalTaskRequestCount + 1,
		},
		{
			sessionTaskRequestCount: sessionTaskRequestCount + 1,
			globalTaskRequestCount: globalTaskRequestCount + 1,
		}
	)

	// Update configuration
	vscode.workspace.getConfiguration().update("globalTaskRequestCount", globalTaskRequestCount + 1, true)
	vscode.workspace.getConfiguration().update("sessionTaskRequestCount", sessionTaskRequestCount + 1, true)
}

// Event: TaskFinish
export const taskFinish = (status: "success" | "failure" | "unknown") => {
	track("TaskFinish", { status })
}

// Event: TaskResume
export const taskResume = (previousStatus: "success" | "failure" | "unknown") => {
	track("TaskResume", { previousStatus })
}

// Event: CreateReferralURL
export const createReferralURL = () => {
	track("CreateReferralURL")
}

// Event: AuthConversion
export const authConversion = (authStartProps: object, causedAuth: boolean) => {
	track("AuthConversion", {
		...authStartProps,
		causedAuth,
	})
}

// Event: Revenue
export const revenue = (
	grossRevenue: number,
	currency: string,
	transactionFees: number,
	netRevenue: number,
	name: string
) => {
	const sequenceSession = vscode.workspace.getConfiguration().get("revenueSequenceSession", 0)
	const sequenceGlobal = vscode.workspace.getConfiguration().get("revenueSequenceGlobal", 0)
	const currentLtv = vscode.workspace.getConfiguration().get("ltv", 0)

	track(
		"Revenue",
		{
			grossRevenue,
			currency,
			transactionFees,
			netRevenue,
			sequenceSession: sequenceSession + 1,
			sequenceGlobal: sequenceGlobal + 1,
			name,
		},
		{
			ltv: currentLtv + grossRevenue,
			ltvCurrency: currency,
		}
	)

	// Update configuration
	vscode.workspace.getConfiguration().update("revenueSequenceSession", sequenceSession + 1, true)
	vscode.workspace.getConfiguration().update("revenueSequenceGlobal", sequenceGlobal + 1, true)
	vscode.workspace.getConfiguration().update("ltv", currentLtv + grossRevenue, true)
}

// Event: Reward
export const reward = (name: string) => {
	track("Reward", { name })
}

// Event: Credit
export const credit = (source: "revenue" | "reward", sourceName: string) => {
	track("Credit", { source, sourceName })
}

// Event: Debit
export const debit = (source: "extension" | "admin", sourceName: string) => {
	track("Debit", { source, sourceName })
}

// Event: EmailOpen
export const emailOpen = (campaignData: object, sequence: number) => {
	track("EmailOpen", { ...campaignData, sequence })
}

// Event: EmailClick
export const emailClick = (campaignData: object, linkData: object, sequence: number) => {
	track("EmailClick", { ...campaignData, ...linkData, sequence })
}

export const extensionActivateSuccess = (isFirst: boolean) => {
	console.log(`My Machine id: ${vscode.env.machineId}`)
	track("ExtensionActivateSuccess", {
		isFirst,
	})
}
