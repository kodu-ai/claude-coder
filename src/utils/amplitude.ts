import { init, track as ampTrack } from "@amplitude/analytics-node"
import axios from "axios"
import osName from "os-name"
import * as vscode from "vscode"
const getUserIP = async () => {
	try {
		const response = await axios.get("https://ipinfo.io/json")
		const data = response.data
		return data.ip as string // returns the external IP address
	} catch (error) {
		console.error("Error fetching user IP:", error)
		return undefined
	}
}

export class AmplitudeTracker {
	private static instance: AmplitudeTracker
	private currentUserId: string | undefined
	private initialized: boolean = false
	private sessionId: string | undefined
	private extensionName: string | undefined
	private ip: string | undefined

	private constructor() {}

	public static getInstance(): AmplitudeTracker {
		if (!AmplitudeTracker.instance) {
			AmplitudeTracker.instance = new AmplitudeTracker()
		}
		return AmplitudeTracker.instance
	}

	public async initialize(
		isLoggedIn: boolean,
		sessionId: string,
		extensionName: string,
		userId?: string
	): Promise<void> {
		if (this.initialized) {
			console.warn("AmplitudeTracker is already initialized. Use updateUserState to change user state.")
			return
		}
		this.sessionId = sessionId
		this.extensionName = extensionName
		const userIp = await getUserIP()
		this.ip = userIp
		init(process.env.AMPLITUDE_API_KEY as string, {
			flushIntervalMillis: 0,
		})

		this.updateUserState(isLoggedIn, userId)
		this.initialized = true
		console.log(`AmplitudeTracker initialized with user ID: ${this.currentUserId}`)
	}

	public updateUserState(isLoggedIn: boolean, userId?: string): void {
		if (isLoggedIn && userId) {
			this.currentUserId = userId
		} else {
			this.currentUserId = undefined
		}
	}

	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error("AmplitudeTracker is not initialized. Call initialize() first.")
		}
	}

	private getDeviceId(): string {
		return vscode.env.machineId
	}

	private async track(eventType: string, eventProperties?: object, userProperties?: object): Promise<void> {
		this.ensureInitialized()
		ampTrack({
			event_type: eventType,
			device_id: this.getDeviceId(),
			event_properties: eventProperties,
			user_properties: {
				...userProperties,
			},
			...(this.ip ? { ip_address: this.ip } : {}),
			user_id: this.currentUserId,
			platform: this.extensionName,
			os_name: osName(),
			extra: {
				extensionName: this.extensionName,
				sessionId: this.sessionId,
				platform: "vscode",
			},
		})
	}

	public sessionStart(): void {
		this.track("SessionStart")
	}

	public taskStart(taskId: string): void {
		this.track("TaskStart", {
			taskId,
		})
	}

	public taskComplete({
		taskId,
		totalCost,
		totalCacheReadTokens,
		totalCacheWriteTokens,
		totalOutputTokens,
		totalInputTokens,
	}: {
		taskId: string
		totalCost: number
		totalCacheReadTokens: number
		totalCacheWriteTokens: number
		totalOutputTokens: number
		totalInputTokens: number
	}): void {
		this.track("TaskComplete", {
			taskId,
			totalCost,
			totalCacheReadTokens,
			totalCacheWriteTokens,
			totalOutputTokens,
			totalInputTokens,
		})
	}

	public taskRequest({
		taskId,
		model,
		apiCost,
		inputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		outputTokens,
	}: {
		taskId: string
		model: string
		apiCost: number
		inputTokens: number
		cacheReadTokens: number
		cacheWriteTokens: number
		outputTokens: number
	}): void {
		this.track("TaskRequest", {
			taskId,
			model,
			apiCost,
			inputTokens,
			cacheReadTokens,
			cacheWriteTokens,
			outputTokens,
		})
	}

	public authStart(): void {
		this.track("AuthStart")
	}

	public authSuccess(): void {
		this.track("AuthSuccess")
	}

	public extensionActivateSuccess(isFirst: boolean): void {
		console.log(`My Machine id: ${this.getDeviceId()}`)
		this.track("ExtensionActivateSuccess", {
			isFirst,
		})
	}

	public referralProgramClick(): void {
		this.track("ReferralProgramClick")
	}

	public addCreditsClick(): void {
		this.track("AddCreditsClick")
	}
}

// Export the singleton instance
export const amplitudeTracker = AmplitudeTracker.getInstance()
