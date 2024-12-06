import * as path from "path"
import { exec } from "child_process"
import { promises as fs } from "fs"
import { ClaudeMessage, GitBranchItem, GitLogItem } from "../../../shared/ExtensionMessage"
import { ToolName } from "../types"
import { has } from "lodash"
import { CommitMessageHandler } from "./commit-message-handler"

export class GitHandler {
	private repoPath: string | undefined
	private DEFAULT_USER_NAME = "kodu-ai"
	private DEFAULT_USER_EMAIL = "bot@kodu.ai"

	constructor() {}

	async init(dirAbsolutePath: string): Promise<boolean> {
		if (!dirAbsolutePath) {
			return false
		}
		this.repoPath = dirAbsolutePath

		return await this.setupRepository()
	}

	private async setupRepository(): Promise<boolean> {
		if (!this.repoPath) {
			return false
		}

		try {
			if (!(await this.isGitInstalled())) {
				console.log("Git is not installed")
				return false
			}

			await this.ensureDirectoryExists(this.repoPath)
			const isInitSuccess = await this.initializeRepository()
			if (!isInitSuccess) {
				return false
			}

			const userName = (await this.getGlobalConfigValue("user.name")) ?? this.DEFAULT_USER_NAME
			const userEmail = (await this.getGlobalConfigValue("user.email")) ?? this.DEFAULT_USER_EMAIL
			await this.setGitConfig("user.name", userName)
			await this.setGitConfig("user.email", userEmail)

			return true
		} catch (error) {
			console.error(`Error initializing git repository: ${error}`)
			return false
		}
	}

	async commitChanges(branchName: string, changes: Array<{ path: string, content: string }>, message?: string): Promise<boolean> {
		try {
			if (!(await this.isGitInstalled())) {
				throw new Error("Git is not installed")
			}

			if (!(await this.isRepositorySetup())) {
				const isSetup = await this.setupRepository()

				if (!isSetup) {
					throw new Error("Failed to setup repository")
				}
			}

			if (!branchName) {
				throw new Error("Branch name is required")
			}
			branchName = branchName.replace(/ /g, "-")

			// Generate commit message if not provided
			const commitMessage = message || CommitMessageHandler.generateCommitMessage(changes)

			return new Promise((resolve) => {
				// Escape the commit message to prevent shell injection
				const escapedMessage = commitMessage.replace(/"/g, '\\"')
				
				exec(
					`git checkout -b ${branchName} && git add . && git commit -m "${escapedMessage}"`,
					{ cwd: this.repoPath },
					(error, stdout, stderr) => {
						if (error) {
							throw new Error(`Error committing changes: ${error} \n ${stderr}`)
						} else {
							resolve(true)
						}
					}
				)
			})
		} catch (error) {
			console.error(`Error committing changes: ${error}`)
			return false
		}
	}

	static async getLog(repoAbsolutePath: string): Promise<GitLogItem[]> {
		if (!repoAbsolutePath) {
			return []
		}

		try {
			return (
				new Promise((resolve) => {
					exec(
						`git log --pretty=format:"%h%x09%ad%x09%s" --date=format:"%Y-%m-%d %H:%M"`,
						{ cwd: repoAbsolutePath },
						(error, stdout, stderr) => {
							if (error) {
								resolve([])
							}

							resolve(this.parseGitLogs(stdout))
						}
					)
				}) ?? []
			)
		} catch (error) {
			console.error(`Error getting log: ${error}`)
			return []
		}
	}

	private static parseGitLogs(stdout: string): GitLogItem[] {
		if (!stdout) {
			return []
		}

		return stdout
			.trim()
			.split("\n")
			.map((line) => {
				const [hash, date, time, ...messageParts] = line.split(/\s+/)
				if (!hash || !date) {
					return null
				}

				return {
					hash,
					datetime: `${date} ${time}`,
					message: messageParts.join(" "),
				}
			})
			.filter((x) => !!x)
	}

	static async getBranches(repoAbsolutePath: string): Promise<GitBranchItem[]> {
		if (!repoAbsolutePath) {
			return []
		}

		return new Promise((resolve, reject) => {
			exec(
				// Updated git command to include lastCommitMessage
				"git for-each-ref --sort=-committerdate refs/heads/ --format='%(if)%(HEAD)%(then)*%(end)|%(refname:short)|%(committerdate:relative)|%(contents:subject)'",
				{ cwd: repoAbsolutePath, maxBuffer: 1024 * 1024 },
				(error, stdout, stderr) => {
					if (error) {
						console.error(`Error getting branches: ${error}`)
						resolve([])
					} else {
						try {
							resolve(this.parseGitBranches(stdout))
						} catch (parseError) {
							console.error(`Error parsing branches: ${parseError}`)
							resolve([])
						}
					}
				}
			)
		})
	}

	static parseGitBranches(stdout: string): GitBranchItem[] {
		if (!stdout.trim()) {
			return []
		}

		const lines = stdout.trim().split("\n")
		const branches: GitBranchItem[] = []

		for (let line of lines) {
			const parts = line.split("|")
			if (parts.length < 4) {
				continue
			}

			const isCheckedOutIndicator = parts[0]
			const name = parts[1]
			const lastCommitRelativeTime = parts[2]
			const lastCommitMessage = parts.slice(3).join("|")

			const isCheckedOut = isCheckedOutIndicator === "*"

			branches.push({
				name,
				lastCommitRelativeTime,
				isCheckedOut,
				lastCommitMessage,
			})
		}

		return branches
	}

	async checkoutTo(identifier: string): Promise<boolean> {
		if (!this.repoPath) {
			return false
		}

		return new Promise((resolve) => {
			const command = `git checkout ${identifier}`
			exec(command, { cwd: this.repoPath }, (error) => {
				if (error) {
					resolve(false)
				} else {
					resolve(true)
				}
			})
		})
	}

	private isGitInstalled(): Promise<boolean> {
		return new Promise((resolve) => {
			exec("git --version", (error, stdout) => {
				if (error || !stdout.startsWith("git version")) {
					resolve(false)
				} else {
					resolve(true)
				}
			})
		})
	}

	private async ensureDirectoryExists(path: string): Promise<void> {
		try {
			await fs.mkdir(path, { recursive: true })
		} catch (error) {
			console.error(`Error creating directory: ${error}`)
		}
	}

	private async initializeRepository(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			exec("git init", { cwd: this.repoPath, shell: process.env.SHELL }, (error, stdout, stderr) => {
				if (error) {
					console.error(error)
					console.log(`Error initializing git repository: ${stderr}`)
					resolve(false)
				} else {
					console.log(stdout.trim())
					resolve(true)
				}
			})
		})
	}

	private async getGlobalConfigValue(key: string): Promise<string | null> {
		return new Promise((resolve) => {
			exec(`git config --global ${key}`, (error, stdout) => {
				if (error) {
					console.error(`Error getting git config ${key}: ${error}`)
					console.log(`Error: ${key}: ${stdout}`)
					resolve(null)
				} else {
					resolve(stdout.trim())
				}
			})
		})
	}

	private async setGitConfig(key: string, value: string): Promise<boolean> {
		return new Promise((resolve) => {
			exec(`git config ${key} "${value}"`, { cwd: this.repoPath }, (error, stdout, stderr) => {
				if (error) {
					console.error(`Error setting git config ${key}: ${error} \n ${stderr}`)
					resolve(false)
				} else {
					console.log(`Git config ${key} set to ${value}`)
					resolve(true)
				}
			})
		})
	}

	private async isRepositorySetup(): Promise<boolean> {
		const initPromise = new Promise<boolean>((resolve, reject) => {
			exec("git rev-parse --is-inside-work-tree", { cwd: this.repoPath }, (error, stdout, stderr) => {
				if (error) {
					resolve(false)
				} else {
					resolve(stdout.trim() === "true")
				}
			})
		})
		const userEmailConfigPromise = this.getLocalConfigValue("user.email")
		const userNameConfigPromise = this.getLocalConfigValue("user.name")

		const [isInit, userEmail, userName] = await Promise.all([
			initPromise,
			userEmailConfigPromise,
			userNameConfigPromise,
		])

		return isInit && !!userEmail && !!userName
	}

	private async getLocalConfigValue(key: string): Promise<string | null> {
		return new Promise((resolve) => {
			exec(`git config ${key}`, { cwd: this.repoPath }, (error, stdout) => {
				if (error) {
					console.error(`Error getting git config ${key}: ${error}`)
					console.log(`Error: ${key}: ${stdout}`)
					resolve(null)
				} else {
					resolve(stdout.trim())
				}
			})
		})
	}
}
