import * as path from "path"
import { exec } from "child_process"
import { promises as fs } from "fs"
import { ClaudeMessage, GitBranchItem, GitLogItem } from "../../../shared/ExtensionMessage"

export class GitHandler {
	private basePath: string
	private repoPath: string | undefined
	private DEFAULT_USER_NAME = "kodu-ai"
	private DEFAULT_USER_EMAIL = "bot@kodu.ai"

	constructor(basePath: string) {
		this.basePath = basePath
	}

	async initFromResumedTask(messages: ClaudeMessage[]): Promise<void> {
		const firstWriteMessage = messages.find(
			(msg) => msg.type === "ask" && msg?.ask === "tool" && JSON.parse(msg?.text ?? "").tool === "newFileCreated"
		)

		if (!firstWriteMessage) {
			return
		}

		const fileWritePath = JSON.parse(firstWriteMessage.text!).path

		await this.setupRepository(fileWritePath)
	}

	async setupRepository(fileWritePath: string): Promise<boolean> {
		if (!this.basePath || !fileWritePath) {
			return false
		}

		const workspaceFolder = fileWritePath.split(path.sep)[0]
		this.repoPath = path.resolve(this.basePath, workspaceFolder)

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

	async commitChanges(message: string, fileWritePath: string = ""): Promise<void> {
		try {
			if (!(await this.isGitInstalled())) {
				console.log("Git is not installed")
				return
			}

			if (!(await this.isRepositorySetup())) {
				const isSetup = await this.setupRepository(fileWritePath)

				if (!isSetup) {
					return
				}
			}

			return new Promise((resolve) => {
				exec(`git add . && git commit -m "${message}"`, { cwd: this.repoPath }, (error, stdout, stderr) => {
					if (error) {
						console.error(`Error committing changes: ${error}`)
						console.log(`Error committing changes: ${stderr}`)
					}
					resolve()
				})
			})
		} catch (error) {
			console.error(`Error committing changes: ${error}`)
		}
	}

	async getLog(): Promise<GitLogItem[]> {
		if (!this.repoPath) {
			return []
		}

		return new Promise((resolve) => {
			exec(
				`git log --pretty=format:"%h%x09%ad%x09%s" --date=format:"%Y-%m-%d %H:%M"`,
				{ cwd: this.repoPath },
				(error, stdout, stderr) => {
					resolve(
						stdout
							.trim()
							.split("\n")
							.map((line) => {
								const [hash, date, time, ...messageParts] = line.split(/\s+/)
								return {
									hash,
									datetime: `${date} ${time}`,
									message: messageParts.join(" "),
								}
							})
					)
				}
			)
		})
	}

	async getBranches(): Promise<GitBranchItem[]> {
		if (!this.repoPath) {
			return []
		}

		return new Promise((resolve) => {
			exec(
				"git for-each-ref --sort=-committerdate refs/heads/ --format='%(if)%(HEAD)%(then)* %(end)%(refname:short) %(committerdate:relative)'",
				{ cwd: this.repoPath },
				(error, stdout, stderr) => {
					const branches = stdout
						.trim()
						.split("\n")
						.map((line) => {
							const isCheckedOut = line.startsWith("*")
							const cleanLine = isCheckedOut ? line.substring(2) : line // Remove "* " if it's the current branch
							const spaceIndex = cleanLine.indexOf(" ")
							const name = cleanLine.substring(0, spaceIndex)
							const lastCommitRelativeTime = cleanLine.substring(spaceIndex + 1).trim()

							return {
								name,
								isCheckedOut,
								lastCommitRelativeTime,
							}
						})

					const sortedBranches = branches.sort((a, b) => {
						if (a.isCheckedOut) return -1
						if (b.isCheckedOut) return 1
						return 0
					})

					resolve(sortedBranches)
				}
			)
		})
	}

	async checkoutTo(identifier: string, newBranchName?: string): Promise<boolean> {
		if (!this.repoPath) {
			return false
		}

		return new Promise((resolve) => {
			const command = newBranchName
				? `git checkout ${identifier} && git checkout -b ${newBranchName}`
				: `git checkout ${identifier}`
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
