import { z } from "zod"
import { procedure } from "../utils"
import { router } from "../utils/router"
import { GlobalStateManager } from "../../providers/state/global-state-manager"
import path from "path"
import fs from "fs/promises"
import { ClaudeMessage } from "../../agent/v1/main-agent"
import { HistoryItem } from "../../shared/history-item"
import { isV1ClaudeMessage, V1ClaudeMessage } from "../../shared/messages/extension-message"
import * as vscode from "vscode"
import archiver from "archiver"
import { createWriteStream } from "fs"
// 2) Define some sub-routers
//
// Example 1: TaskRouter
const taskRouter = router({
	openFile: procedure.input(z.object({ filePath: z.string() })).resolve(async (ctx, input) => {
		// try tp fs access the file
		const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath
		const joinedPath = path.join(rootPath ?? "", input.filePath)
		const isAvailable = await vscode.workspace.fs.stat(vscode.Uri.file(joinedPath)).then(
			() => true,
			() => false
		)
		if (!isAvailable) {
			vscode.window.showErrorMessage(
				`File not found, please make sure the correct task workspace is open and the file exists.`
			)
			return { success: false } as const
		}
		await vscode.window.showTextDocument(vscode.Uri.file(joinedPath))
		return { success: true } as const
	}),
	renameTask: procedure.input(z.object({ taskId: z.string(), newName: z.string() })).resolve((ctx, input) => {
		// ctx.provider?.getTaskManager()?.renameTask({
		// 	taskId: input.taskId,
		// 	newName: input.newName,
		// })
		console.log(`Renamed task ${input.taskId} to ${input.newName}`)
		return { success: true } as const
	}),
	pauseTask: procedure.input(z.object({ taskId: z.string() })).resolve((ctx, input) => {
		// ctx.provider?.getTaskManager()?.pauseTask(input.taskId)
		console.log(`Paused task ${input.taskId}`)
		return { paused: true, taskId: input.taskId } as const
	}),

	restoreTaskFromDisk: procedure.input(z.object({})).resolve(async (ctx, input) => {
		const res = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Restoring tasks...",
				cancellable: false,
			},
			async (progress) => {
				try {
					const currenTasks = await GlobalStateManager.getInstance().getGlobalState("taskHistory")
					const taskDirPath = path.join(ctx.provider.context.globalStorageUri.fsPath, "tasks")

					progress.report({ message: "Checking task directory..." })
					const taskDirExists = await fs
						.access(taskDirPath)
						.then(() => true)
						.catch(() => false)

					const allFolders = await fs.readdir(taskDirPath)
					const allTasks = allFolders.filter((folder) => folder !== ".DS_Store")
					const tasksToRestore = allTasks.filter((task) => !currenTasks?.find((t) => t.id === task))

					const taskHistoryItem: HistoryItem[] = []
					let processedTasks = 0

					for (const task of tasksToRestore) {
						progress.report({
							message: `Restoring task ${processedTasks + 1}/${tasksToRestore.length}`,
							increment: 100 / tasksToRestore.length,
						})

						const claudeMessagesFilePath = path.join(taskDirPath, task, "claude_messages.json")
						try {
							const data = await fs.readFile(claudeMessagesFilePath, "utf-8")
							const stats = await fs.stat(claudeMessagesFilePath)
							const lastEdited = stats.mtimeMs
							const json = JSON.parse(data) as ClaudeMessage[]

							if (Array.isArray(json) && json.length > 0 && json[0].text) {
								console.log(`Restoring task ${task}`)
								const mergedTokens = json.reduce(
									(acc, message) => {
										if (isV1ClaudeMessage(message) && message.apiMetrics) {
											acc.tokensIn += message.apiMetrics.inputTokens
											acc.tokensOut += message.apiMetrics.outputTokens
											acc.totalCost += message.apiMetrics.cost
											acc.cacheReads += message.apiMetrics.inputCacheRead
											acc.cacheWrites += message.apiMetrics.inputCacheWrite
										}
										return acc
									},
									{ tokensIn: 0, tokensOut: 0, totalCost: 0, cacheReads: 0, cacheWrites: 0 }
								)

								const taskText = json[0].text
								const newHistoryItem: HistoryItem = {
									id: task,
									ts: lastEdited,
									task: taskText,
									tokensIn: mergedTokens.tokensIn,
									tokensOut: mergedTokens.tokensOut,
									totalCost: mergedTokens.totalCost,
									cacheReads: mergedTokens.cacheReads,
									cacheWrites: mergedTokens.cacheWrites,
								}
								taskHistoryItem.push(newHistoryItem)
							} else {
								console.log(`Invalid claude_messages.json for task ${task}`)
							}
						} catch (e) {
							console.log(`Error reading claude_messages.json for task ${task}: ${e}`)
						}
						processedTasks++
					}

					if (taskHistoryItem.length > 0) {
						const currentTasks = await GlobalStateManager.getInstance().getGlobalState("taskHistory")
						await GlobalStateManager.getInstance().updateGlobalState("taskHistory", [
							...(currentTasks ?? []),
							...taskHistoryItem,
						])

						console.log(`Restored ${taskHistoryItem.length} tasks`)
					}

					progress.report({ message: "Done, ${taskHistoryItem.length} tasks restored", increment: 100 })
					return { success: true, tasksToRestore, taskHistoryItem } as const
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to restore tasks...`)
					throw error
				}
			}
		)
		if (res.tasksToRestore.length === 0) {
			await vscode.window.showInformationMessage(`No tasks to restore`)
		} else {
			await vscode.window.showInformationMessage(`Restored ${res.tasksToRestore.length} tasks`)
		}
		return res
	}),

	markAsDone: procedure.input(z.object({ taskId: z.string() })).resolve(async (ctx, input) => {
		await ctx.provider?.getTaskManager()?.markTaskAsCompleted(input.taskId, {
			manual: true,
		})
		await ctx.provider.getWebviewManager().postBaseStateToWebview()
		console.log(`Marked task ${input.taskId} as done`)
		return { success: true } as const
	}),

	exportTaskFiles: procedure.input(z.object({ taskId: z.string() })).resolve(async (ctx, input) => {
		const taskDirPath = path.join(ctx.provider.context.globalStorageUri.fsPath, "tasks", input.taskId)

		try {
			console.log("Starting export process...")
			console.log("Task directory path:", taskDirPath)

			const taskDirExists = await fs
				.access(taskDirPath)
				.then(() => true)
				.catch(() => false)

			if (!taskDirExists) {
				console.error(`Task directory not found: ${taskDirPath}`)
				vscode.window.showErrorMessage(`Task ${input.taskId} not found`)
				return { success: false } as const
			}

			const saveDialog = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(`${input.taskId}.zip`),
				filters: { "Zip files": ["zip"] },
				saveLabel: "Export",
				title: `Export task ${input.taskId}`,
			})

			if (!saveDialog) {
				return { success: false } as const
			}

			let savePath = saveDialog.fsPath
			console.log("Original save path:", savePath)

			// Ensure the directory exists
			await fs
				.mkdir(path.dirname(savePath), { recursive: true })
				.catch((err) => console.log("Directory already exists or creation failed:", err))

			return new Promise((resolve, reject) => {
				console.log("Creating write stream to:", savePath)
				const output = createWriteStream(savePath, { flags: "w" })

				output.on("error", (err) => {
					console.error("Write stream error:", err)
					vscode.window.showErrorMessage(`Failed to create output file: ${err.message}`)
					reject({ success: false } as const)
				})

				const archive = archiver("zip", { zlib: { level: 9 } })

				output.on("close", () => {
					console.log("Archive closed successfully")
					vscode.window.showInformationMessage(`Task ${input.taskId} exported to ${savePath}`)
					resolve({ success: true } as const)
				})

				archive.on("error", (err) => {
					console.error("Archive error:", err)
					vscode.window.showErrorMessage(`Export failed: ${err.message}`)
					reject({ success: false } as const)
				})

				archive.on("warning", (err) => {
					console.warn("Archive warning:", err)
				})

				// Pipe archive data to the file
				archive.pipe(output)

				// Add files from directory to the archive
				console.log("Adding files to archive from:", taskDirPath)
				archive.directory(taskDirPath, false)

				console.log("Finalizing archive...")
				archive.finalize()
			})
		} catch (error) {
			console.error("Export error:", error)
			vscode.window.showErrorMessage(`Export failed: ${error}`)
			return { success: false } as const
		}
	}),
})

export default taskRouter
