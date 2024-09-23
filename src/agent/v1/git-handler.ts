import { exec } from "child_process"
import { promises as fs } from "fs"

export class GitHandler {
	private repoPath: string
	private DEFAULT_USER_NAME = "kodu-ai"
	private DEFAULT_USER_EMAIL = "bot@kodu.ai"

	constructor(repoPath: string) {
		this.repoPath = repoPath
	}

	async setupRepository(): Promise<boolean> {
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

			const [isUserNameSet, isUserEmailSet] = await Promise.all([
				this.setGitConfig("user.name", userName),
				this.setGitConfig("user.email", userEmail),
			])

			return isUserNameSet && isUserEmailSet
		} catch (error) {
			console.error(`Error initializing git repository: ${error}`)
			return false
		}
	}

	async commitChanges(message: string): Promise<void> {
		try {
			if (!(await this.isGitInstalled())) {
				console.log("Git is not installed")
				return
			}

			if (!(await this.isRepositorySetup())) {
				const isSetup = await this.setupRepository()

				if (!isSetup) {
					return
				}
			}

			return new Promise(() => {
				exec(`git add . && git commit -m "${message}"`, { cwd: this.repoPath }, (error, stdout, stderr) => {
					if (error) {
						console.error(`Error committing changes: ${error}`)
						console.log(`Error committing changes: ${stderr}`)
					} else {
						console.log(stdout.trim())
					}
				})
			})
		} catch (error) {
			console.error(`Error committing changes: ${error}`)
		}
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
