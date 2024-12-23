import { Anthropic } from "@anthropic-ai/sdk"
import fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { formatAttachementsIntoBlocks } from "../../agent/v1/tools/format-content"
import { HistoryItem } from "../../shared/history-item"
import { Resource } from "../../shared/webview-message"
// import { compressImages, downloadTask, selectImages } from "../../../utils"
import { ExtensionProvider } from "../extension-provider"
import { compressImages, selectImages, downloadTask } from "../../utils"

export class TaskManager {
	private provider: ExtensionProvider

	public constructor(provider: ExtensionProvider) {
		this.provider = provider
	}

	async clearTask() {
		const now = new Date()
		const koduDev = this.provider.getKoduDev()

		this.provider.koduDev = undefined

		if (koduDev) {
			koduDev.abortTask().catch((err) => {
				console.error("Error during task abort:", err)
			})
		}

		console.log(`Task cleared in ${new Date().getTime() - now.getTime()}ms`)
	}

	async switchAutomaticMode() {
		// to implement later
	}

	async handleNewTask(task?: string, images?: string[], attachements?: Resource[]) {
		const compressedImages = await compressImages(images ?? [])
		const additionalContextBlocks = await formatAttachementsIntoBlocks(attachements)
		await this.provider.initWithTask(task + additionalContextBlocks, compressedImages)
	}

	async handleAskResponse(askResponse: any, text?: string, images?: string[], attachements?: Resource[]) {
		const koduDev = this.provider.getKoduDev()
		if (!koduDev) {
			console.error("No KoduDev instance found when handling ask response")
			return
		}

		try {
			const compressedImages = await compressImages(images ?? [])
			const additionalContextBlocks = await formatAttachementsIntoBlocks(attachements)

			await koduDev.handleWebviewAskResponse(
				askResponse,
				text ? text + additionalContextBlocks : undefined,
				compressedImages
			)
		} catch (error) {
			console.error("Error handling ask response:", error)
			vscode.window.showErrorMessage(
				"Error handling response: " + (error instanceof Error ? error.message : String(error))
			)
		}
	}

	async renameTask(
		params:
			| {
					isCurentTask: true
					taskId?: undefined
			  }
			| {
					isCurentTask?: undefined
					taskId: string
			  }
	) {
		let currentTaskId = params.taskId
		if (params.isCurentTask) {
			currentTaskId = this.provider.getKoduDev()?.getStateManager()?.state.taskId!
		}
		if (!currentTaskId) {
			vscode.window.showErrorMessage(`Task not found`)
			return
		}

		const taskData = await this.getTaskWithId(currentTaskId)
		const newTaskName = await this.provider.getWebviewManager().showInputBox({
			prompt: "Enter the new task name",
			value: taskData.historyItem.name,
			validateInput(value) {
				if (!value) {
					return "Task name cannot be empty"
				}
				return null
			},
			placeHolder: "Task name",
		})

		if (!newTaskName) {
			vscode.window.showErrorMessage(`Task name cannot be empty`)
			return
		}

		taskData.historyItem.name = newTaskName
		await this.provider.getStateManager().updateTaskHistory(taskData.historyItem)
		vscode.window.showInformationMessage(`Task renamed to ${newTaskName}`)
	}

	async selectImages() {
		const images = await selectImages()
		return await compressImages(images)
	}

	async exportCurrentTask() {
		const currentTaskId = this.provider.getKoduDev()?.getStateManager()?.state.taskId
		if (currentTaskId) {
			await this.exportTaskWithId(currentTaskId)
		}
	}

	async showTaskWithId(id: string) {
		if (id !== this.provider.getKoduDev()?.getStateManager().state.taskId) {
			const { historyItem } = await this.getTaskWithId(id)
			await this.provider.initWithHistoryItem(historyItem)
		}

		await this.provider.getWebviewManager().postMessageToWebview({
			type: "action",
			action: "chatButtonTapped",
		})
	}

	async exportTaskWithId(id: string) {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id)
		await downloadTask(historyItem.ts, apiConversationHistory)
	}

	async deleteTaskWithId(id: string) {
		if (id === this.provider.getKoduDev()?.getStateManager().state.taskId) {
			await this.clearTask()
		}

		const { taskDirPath, apiConversationHistoryFilePath, claudeMessagesFilePath } = await this.getTaskWithId(id)

		await this.deleteTaskFiles(taskDirPath, apiConversationHistoryFilePath, claudeMessagesFilePath)

		await this.deleteTaskFromState(id)
	}

	async clearAllTasks() {
		this.provider.getStateManager().clearHistory()
		const taskDirPath = path.join(this.provider.getContext().globalStorageUri.fsPath, "tasks")

		const taskDirExists = await fs
			.access(taskDirPath)
			.then(() => true)
			.catch(() => false)

		if (taskDirExists) {
			await fs.rmdir(taskDirPath, { recursive: true })
		}
	}

	public async getTaskWithId(id: string): Promise<{
		historyItem: HistoryItem
		taskDirPath: string
		apiConversationHistoryFilePath: string
		claudeMessagesFilePath: string
		apiConversationHistory: Anthropic.MessageParam[]
	}> {
		const history = (await this.provider.getStateManager().getState()).taskHistory || []
		const historyItem = history.find((item) => item.id === id)

		if (!historyItem) {
			await this.deleteTaskFromState(id)
			throw new Error("Task not found")
		}

		const taskDirPath = path.join(this.provider.getContext().globalStorageUri.fsPath, "tasks", id)
		const apiConversationHistoryFilePath = path.join(taskDirPath, "api_conversation_history.json")
		const claudeMessagesFilePath = path.join(taskDirPath, "claude_messages.json")

		const fileExists = await fs
			.access(apiConversationHistoryFilePath)
			.then(() => true)
			.catch(() => false)

		if (!fileExists) {
			await this.deleteTaskFromState(id)
			throw new Error("Task files not found")
		}

		const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))

		return {
			historyItem,
			taskDirPath,
			apiConversationHistoryFilePath,
			claudeMessagesFilePath,
			apiConversationHistory,
		}
	}

	private async deleteTaskFiles(
		taskDirPath: string,
		apiConversationHistoryFilePath: string,
		claudeMessagesFilePath: string
	) {
		const apiConversationHistoryFileExists = await fs
			.access(apiConversationHistoryFilePath)
			.then(() => true)
			.catch(() => false)

		if (apiConversationHistoryFileExists) {
			await fs.unlink(apiConversationHistoryFilePath)
		}

		const claudeMessagesFileExists = await fs
			.access(claudeMessagesFilePath)
			.then(() => true)
			.catch(() => false)

		if (claudeMessagesFileExists) {
			await fs.unlink(claudeMessagesFilePath)
		}

		await fs.rmdir(taskDirPath)
	}

	private async deleteTaskFromState(id: string) {
		const taskHistory = (await this.provider.getStateManager().getState()).taskHistory || []
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id)
		await this.provider.getGlobalStateManager().updateGlobalState("taskHistory", updatedTaskHistory)

		await this.provider.getWebviewManager().postBaseStateToWebview()
	}
}
