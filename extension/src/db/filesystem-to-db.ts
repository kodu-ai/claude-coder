// import fs from "fs/promises"
// import path from "path"
// import * as vscode from "vscode"
// import DB from "./index"
// import * as schema from "./schema"
// import { ClaudeMessage, V1ClaudeMessage, isV1ClaudeMessage } from "../shared/messages/extension-message"
// import { ApiHistoryItem, FileVersion, SubAgentState } from "../agent/v1/types"
// import { GlobalStateManager } from "../providers/state/global-state-manager"

// async function readJsonFile<T>(filePath: string): Promise<T | null> {
// 	try {
// 		const content = await fs.readFile(filePath, "utf8")
// 		return JSON.parse(content) as T
// 	} catch (error) {
// 		console.error(`Error reading ${filePath}:`, error)
// 		return null
// 	}
// }

// async function migrateTask(taskId: string, tasksPath: string, db: ReturnType<typeof DB.getInstance>) {
// 	const taskPath = path.join(tasksPath, taskId)

// 	// Read claude messages
// 	const claudeMessagesPath = path.join(taskPath, "claude_messages.json")
// 	const claudeMessages = (await readJsonFile<ClaudeMessage[]>(claudeMessagesPath)) || []

// 	if (claudeMessages.length === 0) {
// 		console.log(`No claude messages found for task ${taskId}, skipping...`)
// 		return
// 	}

// 	// Create task entry
// 	const taskMessage = claudeMessages[0]
// 	const [task] = await db
// 		.insert(schema.tasks)
// 		.values({
// 			text: taskMessage.text || "",
// 			createdAt: new Date(taskMessage.ts),
// 			updatedAt: new Date(taskMessage.ts),
// 			isDeleted: false,
// 		})
// 		.returning()

// 	// Process each message pair (human + ai) as a request
// 	for (let i = 0; i < claudeMessages.length; i++) {
// 		const message = claudeMessages[i]
// 		const v1Message = isV1ClaudeMessage(message) ? (message as V1ClaudeMessage) : null

// 		// Create task request
// 		const [taskRequest] = await db
// 			.insert(schema.taskRequests)
// 			.values({
// 				taskId: task.id,
// 				createdAt: new Date(message.ts),
// 				updatedAt: new Date(message.ts),
// 				requestStartedAt: new Date(message.ts),
// 				requestEndedAt: v1Message?.completedAt ? new Date(v1Message.completedAt) : undefined,
// 				isAborted: v1Message?.isAborted ? true : false,
// 			})
// 			.returning()

// 		if (message.type === "say") {
// 			// Human message
// 			await db.insert(schema.humanMessages).values({
// 				taskRequestId: taskRequest.id,
// 				contents: message.text ? [message.text] : [],
// 				createdAt: new Date(message.ts),
// 			})
// 		} else {
// 			// AI response
// 			const agentName =
// 				v1Message?.agentName && typeof v1Message.agentName === "string" ? v1Message.agentName : undefined

// 			await db.insert(schema.aiResponses).values({
// 				taskRequestId: taskRequest.id,
// 				agentName,
// 				contents: message.text ? [message.text] : [],
// 				createdAt: new Date(message.ts),
// 				updatedAt: new Date(v1Message?.completedAt || message.ts),
// 				isError: v1Message?.isError || false,
// 				errorText: v1Message?.errorText,
// 				inputTokens: v1Message?.apiMetrics?.inputTokens,
// 				outputTokens: v1Message?.apiMetrics?.outputTokens,
// 				cost: v1Message?.apiMetrics?.cost,
// 				inputCacheRead: v1Message?.apiMetrics?.inputCacheRead,
// 				inputCacheWrite: v1Message?.apiMetrics?.inputCacheWrite,
// 			})
// 		}
// 	}

// 	// Process file versions
// 	const fileVersionsPath = path.join(taskPath, "file_versions")
// 	try {
// 		const fileVersionDirs = await fs.readdir(fileVersionsPath)

// 		for (const encodedFilePath of fileVersionDirs) {
// 			const fileDir = path.join(fileVersionsPath, encodedFilePath)
// 			const versionFiles = await fs.readdir(fileDir)

// 			for (const versionFile of versionFiles) {
// 				if (!versionFile.startsWith("version_") || !versionFile.endsWith(".json")) continue

// 				const versionData = await readJsonFile<{ content: string; createdAt: number }>(
// 					path.join(fileDir, versionFile)
// 				)
// 				if (!versionData) continue

// 				const versionMatch = versionFile.match(/version_(\d+)\.json$/)
// 				if (!versionMatch) continue

// 				const version = parseInt(versionMatch[1], 10)
// 				const decodedPath = Buffer.from(encodedFilePath, "base64").toString("utf-8").replace(/___/g, path.sep)

// 				await db.insert(schema.taskFiles).values({
// 					taskId: task.id,
// 					filePath: decodedPath,
// 					fileVersion: version,
// 					content: versionData.content,
// 					createdAt: new Date(versionData.createdAt),
// 				})
// 			}
// 		}
// 	} catch (error) {
// 		console.error(`Error processing file versions for task ${taskId}:`, error)
// 	}

// 	// Process sub-agents
// 	const agentDirs = (await fs.readdir(taskPath)).filter(
// 		(dir) => dir !== "claude_messages.json" && dir !== "file_versions"
// 	)

// 	for (const agentHash of agentDirs) {
// 		const agentPath = path.join(taskPath, agentHash)
// 		const statePath = path.join(agentPath, "state.json")
// 		const state = await readJsonFile<SubAgentState>(statePath)

// 		if (!state) continue

// 		// Create agent entry
// 		await db.insert(schema.taskAgents).values({
// 			taskId: task.id,
// 			agentId: agentHash,
// 			agentName: typeof state.name === "string" ? state.name : "unknown",
// 			isMainThread: false,
// 			createdAt: new Date(state.ts),
// 			updatedAt: new Date(state.ts),
// 		})
// 	}
// }

// export async function migrateFilesystemToDatabase(tasksPath: string, context: vscode.ExtensionContext): Promise<void> {
// 	const globalState = GlobalStateManager.getInstance(context)
// 	const isMigrated = globalState.getGlobalState("isFilesystemMigrated")

// 	if (isMigrated) {
// 		console.log("Filesystem migration already completed")
// 		return
// 	}

// 	console.log("Starting filesystem to database migration...")

// 	try {
// 		const taskDirs = await fs.readdir(tasksPath)
// 		const db = DB.getInstance()

// 		console.log(`Found ${taskDirs.length} tasks to migrate`)

// 		for (const taskId of taskDirs) {
// 			console.log(`Migrating task ${taskId}...`)
// 			await migrateTask(taskId, tasksPath, db)
// 		}

// 		await globalState.updateGlobalState("isFilesystemMigrated", true)
// 		console.log("Migration completed successfully")
// 	} catch (error) {
// 		console.error("Migration failed:", error)
// 		throw error
// 	}
// }
