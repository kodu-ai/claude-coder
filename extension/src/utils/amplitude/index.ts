import { init, track as ampTrack } from "@amplitude/analytics-node"
import axios from "axios"
import osName from "os-name"
import * as vscode from "vscode"
import { AmplitudeMetrics, TaskCompleteEventParams, TaskRequestEventParams } from "./types"

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
	private globalState: vscode.Memento | undefined
	private currentTaskRequestCount = 0
	private sessionTaskRequestCount = 0
	private constructor() {}

	public static getInstance(): AmplitudeTracker {
		if (!AmplitudeTracker.instance) {
			AmplitudeTracker.instance = new AmplitudeTracker()
		}
		return AmplitudeTracker.instance
	}

	public async initialize(
		globalState: vscode.Memento,
		isLoggedIn: boolean,
		sessionId: string,
		extensionName: string,
		userId?: string
	): Promise<void> {
		if (this.initialized) {
			console.warn("AmplitudeTracker is already initialized. Use updateUserState to change user state.")
			return
		}

		this.globalState = globalState
		this.sessionId = sessionId
		this.extensionName = extensionName
		this.sessionTaskRequestCount = 0

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

	public sessionStart(): void {
		this.track("SessionStart")
	}

	public taskStart(taskId: string): void {
		this.currentTaskRequestCount = 0

		this.track("TaskStart", {
			taskId,
		})
	}

	public taskResume(taskId: string, pastRequestsCount: number): void {
		this.currentTaskRequestCount = pastRequestsCount

		this.track("TaskResume", {
			taskId,
		})
	}

	public taskRequest(params: TaskRequestEventParams): void {
		this.incrementMetric(AmplitudeMetrics.GLOBAL_TASK_REQUEST_COUNT)
		const globalTaskRequestCount = this.getMetric(AmplitudeMetrics.GLOBAL_TASK_REQUEST_COUNT)

		this.track(
			"TaskRequest",
			{
				...params,
				thisTaskRequestCount: ++this.currentTaskRequestCount,
				globalTaskRequestCount,
			},
			{
				sessionTaskRequestCount: ++this.sessionTaskRequestCount,
				globalTaskRequestCount,
			}
		)
	}

	public taskComplete(params: TaskCompleteEventParams): void {
		this.track("TaskComplete", params)
	}

	public authStart(): void {
		this.track("AuthStart")
	}

	public authSuccess(): void {
		this.track("AuthSuccess")
	}

	public extensionActivateSuccess(isFirst: boolean): void {
		this.track("ExtensionActivateSuccess", {
			isFirst,
		})
	}

	public referralProgramClick(): void {
		this.track("ReferralProgramClick")
	}

	public addCreditsClick(): void {
		this.track("ExtensionCreditAddOpen")
	}

	public extensionCreditAddSelect(key: string): void {
		this.track("ExtensionCreditAddSelect", {
			key,
		})
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

	private ensureInitialized(): void {
		if (!this.initialized) {
			// throw new Error("AmplitudeTracker is not initialized. Call initialize() first.")
		}
	}

	private getDeviceId(): string {
		return vscode.env.machineId
	}

	private getMetric(key: string): number {
		return this.globalState?.get(key) || 0
	}

	private incrementMetric(key: string): void {
		const currentCount = this.getMetric(key)
		this.globalState?.update(key, currentCount + 1)
	}
}

// Export the singleton instance
export const amplitudeTracker = AmplitudeTracker.getInstance()
