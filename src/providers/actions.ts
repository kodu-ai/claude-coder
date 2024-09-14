import { fetchKoduUser as fetchKoduUserAPI } from "../api/kodu"
import { ApiModelId } from "../shared/api"
import { compressImages, selectImages } from "../utils"
import { amplitudeTracker } from "../utils/amplitude"
import { ClaudeDevProvider } from "./ClaudeDevProvider"

export interface Message {
	type: keyof typeof actions
	[key: string]: any
}

export interface Messages {
	[key: string]: (instance: ClaudeDevProvider, message: Message) => Promise<void>
}

export async function executeAction(instance: ClaudeDevProvider, message: Message) {
	const action = actions[message.type as keyof typeof actions]
	if (action) {
		await action(instance, message)
	} else {
		console.error(`No action found for type: ${message.type}`)
	}
}

export const : Messages = {
	amplitude: async (instance: ClaudeDevProvider, message: Message) => {
		if (message.event_type === "Add Credits") {
			amplitudeTracker.addCreditsClick()
		}
		if (message.event_type === "Referral Program") {
			amplitudeTracker.referralProgramClick()
		}
		if (message.event_type === "Auth Start") {
			amplitudeTracker.authStart()
		}
	},

	cancelCurrentRequest: async (instance: ClaudeDevProvider, message: Message) => {
		await instance.koduDev?.taskExecutor.cancelCurrentRequest()
		await instance.postStateToWebview()
	},

	abortAutomode: async (instance: ClaudeDevProvider, message: Message) => {
		await instance.clearTask()
		await instance.postStateToWebview()
	},

	webviewDidLaunch: async (instance: ClaudeDevProvider, message: Message) => {
		instance.getState()
		await instance.postStateToWebview()
	},

	newTask: async (instance: ClaudeDevProvider, message: Message) => {
		if (message.images && message.images?.length > 0) {
			const compressedImages = await compressImages(message.images)
			await instance.initClaudeDevWithTask(
				message.text,
				compressedImages.map((img) => img.data)
			)
		} else {
			await instance.initClaudeDevWithTask(message.text, message.images)
		}
	},

	apiConfiguration: async (instance: ClaudeDevProvider, message: Message) => {
		if (message.apiConfiguration) {
			const { apiModelId, koduApiKey } = message.apiConfiguration
			await instance.updateGlobalState("apiModelId", apiModelId as ApiModelId)
			await instance.storeSecret("koduApiKey", koduApiKey)
			console.log(`apiConfiguration: ${JSON.stringify(message.apiConfiguration)}`)
			instance.koduDev?.getStateManager().apiManager.updateApi({
				koduApiKey,
				apiModelId: apiModelId as ApiModelId,
			})

			await instance.postStateToWebview()
		}
	},

	maxRequestsPerTask: async (instance: ClaudeDevProvider, message: Message) => {
		let result: number | undefined = undefined
		if (message.text && message.text.trim()) {
			const num = Number(message.text)
			if (!isNaN(num)) {
				result = num
			}
		}
		await instance.updateGlobalState("maxRequestsPerTask", result)
		instance.koduDev?.getStateManager().setMaxRequestsPerTask(result)
		await instance.postStateToWebview()
	},

	customInstructions: async (instance: ClaudeDevProvider, message: Message) => {
		await instance.updateGlobalState("customInstructions", message.text || undefined)
		instance.koduDev?.getStateManager().setCustomInstructions(message.text || undefined)
		await instance.postStateToWebview()
	},

	alwaysAllowReadOnly: async (instance: ClaudeDevProvider, message: Message) => {
		await instance.updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined)
		instance.koduDev?.getStateManager().setAlwaysAllowReadOnly(message.bool ?? false)
		await instance.postStateToWebview()
	},

	alwaysAllowWriteOnly: async (instance: ClaudeDevProvider, message: Message) => {
		await instance.updateGlobalState("alwaysAllowWriteOnly", message.bool ?? undefined)
		instance.koduDev?.getStateManager().setAlwaysAllowWriteOnly(message.bool ?? false)
		await instance.postStateToWebview()
	},

	askResponse: async (instance: ClaudeDevProvider, message: Message) => {
		if (message.images && message.images.length > 0) {
			const compressedImages = await compressImages(message.images)
			instance.koduDev?.handleWebviewAskResponse(
				message.askResponse!,
				message.text,
				compressedImages.map((img) => img.data)
			)
		} else {
			instance.koduDev?.handleWebviewAskResponse(message.askResponse!, message.text, message.images)
		}
	},

	clearTask: async (instance: ClaudeDevProvider, message: Message) => {
		await instance.clearTask()
		await instance.postStateToWebview()
	},

	didCloseAnnouncement: async (instance: ClaudeDevProvider, message: Message) => {
		await instance.updateGlobalState("lastShownAnnouncementId", instance.latestAnnouncementId)
		await instance.postStateToWebview()
	},

	selectImages: async (instance: ClaudeDevProvider, message: Message) => {
		const images = await selectImages()
		const compressedImages = await compressImages(images)
		await instance.postMessageToWebview({
			type: "selectedImages",
			images: compressedImages.map((img) => img.data),
		})
	},

	exportCurrentTask: async (instance: ClaudeDevProvider, message: Message) => {
		const currentTaskId = instance.koduDev?.getStateManager()?.state.taskId
		if (currentTaskId) {
			instance.exportTaskWithId(currentTaskId)
		}
	},

	showTaskWithId: async (instance: ClaudeDevProvider, message: Message) => {
		instance.showTaskWithId(message.text!)
	},

	deleteTaskWithId: async (instance: ClaudeDevProvider, message: Message) => {
		instance.deleteTaskWithId(message.text!)
	},

	setCreativeMode: async (instance: ClaudeDevProvider, message: Message) => {
		console.log(`setCreativeMode: ${message.text}`)
		instance.updateGlobalState("creativeMode", message.text as "creative" | "normal" | "deterministic")
		instance.koduDev?.getStateManager()?.setCreativeMode(message.text as "creative" | "normal" | "deterministic")
		await instance.postStateToWebview()
	},

	exportTaskWithId: async (instance: ClaudeDevProvider, message: Message) => {
		instance.exportTaskWithId(message.text!)
	},

	didClickKoduSignOut: async (instance: ClaudeDevProvider, message: Message) => {
		await instance.signOutKodu()
	},

	fetchKoduCredits: async (instance: ClaudeDevProvider, message: Message) => {
		const koduApiKey = await instance.getSecret("koduApiKey")
		if (koduApiKey) {
			const user = await fetchKoduUserAPI({ apiKey: koduApiKey })
			console.log(`fetchKoduCredits credits: ${JSON.stringify(user)}`)
			if (user) {
				await instance.updateGlobalState("user", user)
			}
			await instance.postMessageToWebview({
				type: "action",
				action: "koduCreditsFetched",
				state: await instance.getStateToPostToWebview(),
			})
		}
	},

	didDismissKoduPromo: async (instance: ClaudeDevProvider, message: Message) => {
		await instance.updateGlobalState("shouldShowKoduPromo", false)
		await instance.postStateToWebview()
	},

	resetState: async (instance: ClaudeDevProvider, message: Message) => {
		await instance.resetState()
	},
}
