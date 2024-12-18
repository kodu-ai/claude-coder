// src/state-manager/io-manager.ts
import fs from "fs/promises"
import path from "path"
import { ApiHistoryItem, ClaudeMessage, FileVersion } from "../types"

interface IOManagerOptions {
	fsPath: string
	taskId: string
}

/**
 * IOManager now handles all file I/O directly without a worker.
 * It is responsible for:
 * - Ensuring directories exist
 * - Reading/writing Claude messages and API history
 * - Managing file versions I/O
 */
export class IOManager {
	private fsPath: string
	private taskId: string

	constructor(options: IOManagerOptions) {
		this.fsPath = options.fsPath
		this.taskId = options.taskId
	}

	private async ensureTaskDirectoryExists(): Promise<string> {
		const taskDir = path.join(this.fsPath, "tasks", this.taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
	}

	private async getClaudeMessagesFilePath(): Promise<string> {
		const taskDir = await this.ensureTaskDirectoryExists()
		return path.join(taskDir, "claude_messages.json")
	}

	private async getApiHistoryFilePath(): Promise<string> {
		const taskDir = await this.ensureTaskDirectoryExists()
		return path.join(taskDir, "api_conversation_history.json")
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
		this.getClaudeMessagesFilePath()
			.then((filePath) => {
				const data = JSON.stringify(messages, null, 2)
				// Fire and forget
				fs.writeFile(filePath, data).catch((err) => console.error("Failed to save Claude messages:", err))
			})
			.catch((err) => console.error("Failed to get Claude messages file path:", err))
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
		this.getApiHistoryFilePath()
			.then((filePath) => {
				const data = JSON.stringify(history, null, 2)
				// Fire and forget
				fs.writeFile(filePath, data).catch((err) => console.error("Failed to save API history:", err))
			})
			.catch((err) => console.error("Failed to get API history file path:", err))
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
		await fs.writeFile(versionFilePath, JSON.stringify(data, null, 2))
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
				if (!versionMatch) continue
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

	private encodeFilePath(filePath: string): string {
		const replaced = filePath.replace(/[/\\]/g, "___")
		return Buffer.from(replaced).toString("base64")
	}

	private decodeFilePath(encoded: string): string {
		const decoded = Buffer.from(encoded, "base64").toString("utf-8")
		return decoded.replace(/___/g, path.sep)
	}
}
