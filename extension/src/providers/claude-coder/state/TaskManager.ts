import { Anthropic } from "@anthropic-ai/sdk"
import fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { formatAttachementsIntoBlocks } from "../../../agent/v1/tools/format-content"
import { HistoryItem } from "../../../shared/HistoryItem"
import { Resource } from "../../../shared/WebviewMessage"
import { compressImages, downloadTask, selectImages } from "../../../utils"
import { ExtensionProvider } from "../ClaudeCoderProvider"

export class TaskManager {
	constructor(private provider: ExtensionProvider) {}

	async clearTask() {
		await this.provider.getKoduDev()?.abortTask()
		this.provider["koduDev"] = undefined
	}

	async handleNewTask(task?: string, images?: string[], attachements?: Resource[]) {
		const compressedImages = await compressImages(images ?? [])
		const additionalContextBlocks = await formatAttachementsIntoBlocks(attachements)
		await this.provider.initWithTask(task + additionalContextBlocks, compressedImages)
	}

	async handleAskResponse(askResponse: any, text?: string, images?: string[], attachements?: Resource[]) {
		const compressedImages = await compressImages(images ?? [])
		const additionalContextBlocks = await formatAttachementsIntoBlocks(attachements)
		this.provider
			.getKoduDev()
			?.handleWebviewAskResponse(askResponse, text + additionalContextBlocks, compressedImages)
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
			// throw vscode error message
			vscode.window.showErrorMessage(`Task not found`)
			return
		}
		const taskData = await this.getTaskWithId(currentTaskId)
		// vscode dialog to rename task
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
		await this.provider.getWebviewManager().postStateToWebview()
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
			// await this.provider.getKoduDev()?.taskExecutor.gitHandler.init(historyItem.dirAbsolutePath!)
		}

		// await this.provider.getTaskExecutor().runTask()
		await this.provider.getWebviewManager().postMessageToWebview({ type: "action", action: "chatButtonTapped" })
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

		// Delete the task files
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

		await this.deleteTaskFromState(id)
	}

	async clearAllTasks() {
		// delete all tasks from state and delete task folder
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
		if (historyItem) {
			const taskDirPath = path.join(this.provider.getContext().globalStorageUri.fsPath, "tasks", id)
			const apiConversationHistoryFilePath = path.join(taskDirPath, "api_conversation_history.json")
			const claudeMessagesFilePath = path.join(taskDirPath, "claude_messages.json")
			const fileExists = await fs
				.access(apiConversationHistoryFilePath)
				.then(() => true)
				.catch(() => false)
			if (fileExists) {
				const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))
				return {
					historyItem,
					taskDirPath,
					apiConversationHistoryFilePath,
					claudeMessagesFilePath,
					apiConversationHistory,
				}
			}
		}
		// if we tried to get a task that doesn't exist, remove it from state
		await this.deleteTaskFromState(id)
		throw new Error("Task not found")
	}

	private async deleteTaskFromState(id: string) {
		const taskHistory = (await this.provider.getStateManager().getState()).taskHistory || []
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id)
		await this.provider.getGlobalStateManager().updateGlobalState("taskHistory", updatedTaskHistory)

		await this.provider.getWebviewManager().postStateToWebview()
	}
}
