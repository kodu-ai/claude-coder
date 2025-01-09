// src/state-manager/io-manager.ts
import fs from "fs/promises"
import path from "path"
import { writeFile } from "atomically"
import { ApiHistoryItem, ClaudeMessage, FileVersion, SubAgentState } from "../types"

interface IOManagerOptions {
	fsPath: string
	taskId: string
	agentHash?: string
}

type WriteOperation = {
	type: "claudeMessages" | "apiHistory" | "subAgentState" | "fileVersion"
	data: any
	filePath: string
}

/**
 * IOManager now handles all file I/O in the background using a queue.
 * It is responsible for:
 * - Ensuring directories exist
 * - Reading/writing Claude messages and API history
 * - Managing file versions I/O
 */
export class IOManager {
	private fsPath: string
	private taskId: string
	private _agentHash?: string
	private writeQueue: WriteOperation[] = []
	private isFlushing: boolean = false

	constructor(options: IOManagerOptions) {
		this.fsPath = options.fsPath
		this.taskId = options.taskId
		this._agentHash = options.agentHash

		// Start the background flush loop
		setInterval(() => this.flushQueue(), 20)
	}

	public get agentHash(): string | undefined {
		return this._agentHash
	}

	public set agentHash(value: string | undefined) {
		this._agentHash = value
	}

	private async ensureTaskDirectoryExists(): Promise<string> {
		const taskDir = path.join(this.fsPath, "tasks", this.taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
	}

	private async getSubAgentDirectory(): Promise<string> {
		if (!this.agentHash) {
			throw new Error("Agent hash is not set")
		}
		const taskDir = await this.ensureTaskDirectoryExists()
		const agentDir = path.join(taskDir, this.agentHash ?? "")
		await fs.mkdir(agentDir, { recursive: true })
		return agentDir
	}

	public async saveSubAgentState(state: SubAgentState): Promise<void> {
		const subAgentDir = await this.getSubAgentDirectory()
		const stateFilePath = path.join(subAgentDir, "state.json")
		this.enqueueWriteOperation("subAgentState", state, stateFilePath)
	}

	public async loadSubAgentState(): Promise<SubAgentState | undefined> {
		const subAgentDir = await this.getSubAgentDirectory()
		const stateFilePath = path.join(subAgentDir, "state.json")

		try {
			const data = await fs.readFile(stateFilePath, "utf8")
			const state: SubAgentState = JSON.parse(data)
			return state
		} catch {
			return undefined
		}
	}

	private async getClaudeMessagesFilePath(): Promise<string> {
		const taskDir = await this.ensureTaskDirectoryExists()
		return path.join(taskDir, "claude_messages.json")
	}

	private async getApiHistoryFilePath(): Promise<string> {
		const taskDir = await this.ensureTaskDirectoryExists()
		return path.join(taskDir, this.agentHash ?? "", "api_conversation_history.json")
	}

	// ---------- Claude Messages I/O ----------
	public async loadClaudeMessages(): Promise<ClaudeMessage[]> {
		const filePath = await this.getClaudeMessagesFilePath()

		try {
			const data = await fs.readFile(filePath, "utf8")
			const messages: ClaudeMessage[] = JSON.parse(data)
			return messages
		} catch {
			// If file does not exist or fails to parse, return empty array
			return []
		}
	}

	public async saveClaudeMessages(messages: ClaudeMessage[]): Promise<void> {
		const filePath = await this.getClaudeMessagesFilePath()
		this.enqueueWriteOperation("claudeMessages", messages, filePath)
	}

	// ---------- API History I/O ----------
	public async loadApiHistory(): Promise<ApiHistoryItem[]> {
		const filePath = await this.getApiHistoryFilePath()

		try {
			const data = await fs.readFile(filePath, "utf8")
			const history: ApiHistoryItem[] = JSON.parse(data)
			return history
		} catch {
			// If file does not exist or fails to parse, return empty array
			return []
		}
	}

	public async saveApiHistory(history: ApiHistoryItem[]): Promise<void> {
		const filePath = await this.getApiHistoryFilePath()
		this.enqueueWriteOperation("apiHistory", history, filePath)
	}

	// ---------- File Versions I/O ----------
	private async getFileVersionsDir(): Promise<string> {
		const taskDir = await this.ensureTaskDirectoryExists()
		const versionsDir = path.join(taskDir, "file_versions")
		await fs.mkdir(versionsDir, { recursive: true })
		return versionsDir
	}

	public async saveFileVersion(file: FileVersion): Promise<void> {
		const versionsDir = await this.getFileVersionsDir()
		const encodedPath = this.encodeFilePath(file.path)
		const fileDir = path.join(versionsDir, encodedPath)
		await fs.mkdir(fileDir, { recursive: true })

		const versionFilePath = path.join(fileDir, `version_${file.version}.json`)
		const data = {
			content: file.content,
			createdAt: file.createdAt,
		}
		this.enqueueWriteOperation("fileVersion", data, versionFilePath)
	}

	public async deleteFileVersion(file: FileVersion): Promise<void> {
		const versionsDir = await this.getFileVersionsDir()
		const encodedPath = this.encodeFilePath(file.path)
		const fileDir = path.join(versionsDir, encodedPath)

		const versionFilePath = path.join(fileDir, `version_${file.version}.json`)
		await fs.unlink(versionFilePath)
	}

	public async getFileVersions(relPath: string): Promise<FileVersion[]> {
		const versionsDir = await this.getFileVersionsDir()
		const encodedPath = this.encodeFilePath(relPath)
		const fileDir = path.join(versionsDir, encodedPath)

		try {
			const entries = await fs.readdir(fileDir)
			const versionFiles = entries.filter((e) => e.startsWith("version_") && e.endsWith(".json"))
			const versions: FileVersion[] = []
			for (const vf of versionFiles) {
				const versionMatch = vf.match(/version_(\d+)\.json$/)
				if (!versionMatch) {
					continue
				}
				const verNum = parseInt(versionMatch[1], 10)
				const fullPath = path.join(fileDir, vf)
				const contentStr = await fs.readFile(fullPath, "utf8")
				const json = JSON.parse(contentStr)
				versions.push({
					path: relPath,
					version: verNum,
					createdAt: json.createdAt,
					content: json.content,
				})
			}
			versions.sort((a, b) => a.version - b.version)
			return versions
		} catch {
			return []
		}
	}

	public async getFilesInTaskDirectory(): Promise<Record<string, FileVersion[]>> {
		const versionsDir = await this.getFileVersionsDir()
		const result: Record<string, FileVersion[]> = {}
		try {
			const fileDirs = await fs.readdir(versionsDir)
			for (const fd of fileDirs) {
				const fileDir = path.join(versionsDir, fd)
				const stat = await fs.lstat(fileDir)
				if (stat.isDirectory()) {
					const relPath = this.decodeFilePath(fd)
					const versions = await this.getFileVersions(relPath)
					result[relPath] = versions
				}
			}
		} catch {
			// No files
		}
		return result
	}

	// ---------- Utility ----------

	private encodeFilePath(filePath: string): string {
		const replaced = filePath.replace(/[/\\]/g, "___")
		return Buffer.from(replaced).toString("base64")
	}

	private decodeFilePath(encoded: string): string {
		const decoded = Buffer.from(encoded, "base64").toString("utf-8")
		return decoded.replace(/___/g, path.sep)
	}

	// ---------- Background Queue Management ----------

	private enqueueWriteOperation(type: WriteOperation["type"], data: any, filePath: string): void {
		this.writeQueue.push({ type, data, filePath })
	}

	private async flushQueue(): Promise<void> {
		if (this.isFlushing || this.writeQueue.length === 0) {
			return
		}

		this.isFlushing = true

		try {
			const operation = this.writeQueue.shift()
			if (operation) {
				const { type, data, filePath } = operation
				const jsonData = JSON.stringify(data, null, 2)

				await writeFile(filePath, jsonData).catch((err) => {
					console.error(`Failed to save ${type}:`, err)
				})
			}
		} finally {
			this.isFlushing = false
		}
	}
}
