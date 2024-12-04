import { execa, ExecaError } from "execa"
import { promises as fs } from "fs"
import { GitBranchItem, GitLogItem } from "../../../shared/ExtensionMessage"

export type GitCommitResult = {
	branch: string
	commitHash: string
}

export class GitHandler {
	private repoPath: string | undefined
	private readonly DEFAULT_USER_NAME = "kodu-ai"
	private readonly DEFAULT_USER_EMAIL = "bot@kodu.ai"

	constructor(repoPath: string) {
		this.repoPath = repoPath
	}

	async init(): Promise<boolean> {
		if (!this.repoPath) {
			return false
		}
		return this.setupRepository()
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

			// Using default values directly as commented in original code
			const userName = this.DEFAULT_USER_NAME
			const userEmail = this.DEFAULT_USER_EMAIL

			await this.setGitConfig("user.name", userName)
			await this.setGitConfig("user.email", userEmail)

			return true
		} catch (error) {
			console.error(`Error initializing git repository: ${error}`)
			return false
		}
	}

	async commitEverything(message: string): Promise<GitCommitResult> {
		try {
			await this.prepareForCommit()
			return this.commitWithMessage(".", message)
		} catch (error) {
			throw new Error(`Error committing changes: ${error}`)
		}
	}

	async commitOnFileWrite(path: string): Promise<GitCommitResult> {
		try {
			await this.prepareForCommit()

			if (!path) {
				throw new Error("Path is required")
			}

			const message = await this.getCommitMessage(path)
			if (!message) {
				throw new Error("Failed to generate commit message")
			}

			return this.commitWithMessage(path, message)
		} catch (error) {
			throw new Error(`Error committing changes: ${error}`)
		}
	}

	private async prepareForCommit(): Promise<void> {
		if (!(await this.isGitInstalled())) {
			throw new Error("Git is not installed")
		}

		if (!(await this.isRepositorySetup())) {
			const isSetup = await this.setupRepository()
			if (!isSetup) {
				throw new Error("Failed to setup repository")
			}
		}
	}

	private async commitWithMessage(path: string, message: string): Promise<GitCommitResult> {
		try {
			// Separate add and commit for better error handling
			await execa("git", ["add", path], { cwd: this.repoPath })
			const { stdout } = await execa("git", ["commit", "-m", message], { cwd: this.repoPath })
			return this.getCommittedHash(stdout.trim())
		} catch (error) {
			if (error instanceof ExecaError) {
				console.error(`Error committing changes: ${error.stderr || error.message}`)
				throw new Error(`Error committing changes: ${error.stderr || error.message}`)
			}
			throw new Error(`Error committing changes: ${error}`)
		}
	}

	private async getCommitMessage(path: string): Promise<string> {
		const { stdout } = await execa("git", ["status", "-s"], { cwd: this.repoPath })
		const statusLines = stdout.split("\n")
		const statusLine = statusLines.find((line) => line.includes(path))

		return statusLine?.startsWith("M") ? `Updated ${path}` : `Added ${path}`
	}

	private getCommittedHash(gitCommitStdOut: string): GitCommitResult {
		const firstLine = gitCommitStdOut.split("\n")[0]
		const match = firstLine.match(/\[(.*?)\s+(.*?)\]/)
		if (!match) {
			throw new Error("Unable to parse commit output")
		}

		return {
			branch: match[1],
			commitHash: match[2],
		}
	}

	static async getLog(repoAbsolutePath: string): Promise<GitLogItem[]> {
		if (!repoAbsolutePath) {
			return []
		}

		try {
			const { stdout } = await execa(
				"git",
				["log", "--pretty=format:%h%x09%ad%x09%s", "--date=format:%Y-%m-%d %H:%M"],
				{ cwd: repoAbsolutePath }
			)

			return this.parseGitLogs(stdout)
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
			.filter((x): x is GitLogItem => x !== null)
	}

	static async getBranches(repoAbsolutePath: string): Promise<GitBranchItem[]> {
		if (!repoAbsolutePath) {
			return []
		}

		try {
			const { stdout } = await execa(
				"git",
				[
					"for-each-ref",
					"--sort=-committerdate",
					"refs/heads/",
					"--format=%(if)%(HEAD)%(then)*%(end)|%(refname:short)|%(committerdate:relative)|%(contents:subject)",
				],
				{
					cwd: repoAbsolutePath,
					maxBuffer: 1024 * 1024,
				}
			)

			return this.parseGitBranches(stdout)
		} catch (error) {
			console.error(`Error getting branches: ${error}`)
			return []
		}
	}

	static parseGitBranches(stdout: string): GitBranchItem[] {
		if (!stdout.trim()) {
			return []
		}

		const lines = stdout.trim().split("\n")
		return lines
			.map((line) => {
				const parts = line.split("|")
				if (parts.length < 4) return null

				return {
					name: parts[1],
					lastCommitRelativeTime: parts[2],
					isCheckedOut: parts[0] === "*",
					lastCommitMessage: parts.slice(3).join("|"),
				}
			})
			.filter((x): x is GitBranchItem => x !== null)
	}

	async checkoutTo(identifier: string): Promise<boolean> {
		if (!this.repoPath) {
			return false
		}

		try {
			await execa("git", ["checkout", identifier], { cwd: this.repoPath })
			return true
		} catch {
			return false
		}
	}

	async getCurrentBranch(): Promise<string | null> {
		if (!this.repoPath) {
			return null
		}

		try {
			const { stdout } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: this.repoPath })
			return stdout.trim()
		} catch (error) {
			console.error(`Error getting current branch: ${error}`)
			return null
		}
	}

	async getCurrentCommit(): Promise<string | null> {
		if (!this.repoPath) {
			return null
		}

		try {
			const { stdout } = await execa("git", ["rev-parse", "HEAD"], { cwd: this.repoPath })
			return stdout.trim()
		} catch (error) {
			console.error(`Error getting current commit: ${error}`)
			return null
		}
	}

	async createBranchAtCommit(branchName: string, commitHash: string): Promise<boolean> {
		if (!this.repoPath) {
			return false
		}

		try {
			await execa("git", ["branch", branchName, commitHash], { cwd: this.repoPath })
			return true
		} catch (error) {
			console.error(`Error creating branch at commit: ${error}`)
			return false
		}
	}

	async resetHardTo(commitHash: string): Promise<boolean> {
		if (!this.repoPath) {
			return false
		}

		try {
			await execa("git", ["reset", "--hard", commitHash], { cwd: this.repoPath })
			return true
		} catch (error) {
			console.error(`Error resetting to commit: ${error}`)
			return false
		}
	}

	async deleteBranch(branchName: string): Promise<boolean> {
		if (!this.repoPath) {
			return false
		}

		try {
			await execa("git", ["branch", "-D", branchName], { cwd: this.repoPath })
			return true
		} catch (error) {
			console.error(`Error deleting branch: ${error}`)
			return false
		}
	}

	private async isGitInstalled(): Promise<boolean> {
		try {
			const { stdout } = await execa("git", ["--version"])
			return stdout.startsWith("git version")
		} catch {
			return false
		}
	}

	private async ensureDirectoryExists(path: string): Promise<void> {
		try {
			await fs.mkdir(path, { recursive: true })
		} catch (error) {
			console.error(`Error creating directory: ${error}`)
		}
	}

	private async initializeRepository(): Promise<boolean> {
		try {
			await execa("git", ["init"], {
				cwd: this.repoPath,
				shell: process.env.SHELL,
			})
			return true
		} catch (error) {
			console.error(`Error initializing git repository: ${error}`)
			return false
		}
	}

	private async setGitConfig(key: string, value: string): Promise<boolean> {
		try {
			await execa("git", ["config", key, value], { cwd: this.repoPath })
			console.log(`Git config ${key} set to ${value}`)
			return true
		} catch (error) {
			console.error(`Error setting git config ${key}: ${error}`)
			return false
		}
	}

	private async isRepositorySetup(): Promise<boolean> {
		try {
			const [isInit, userEmail, userName] = await Promise.all([
				this.checkIsGitRepository(),
				this.getLocalConfigValue("user.email"),
				this.getLocalConfigValue("user.name"),
			])

			return isInit && !!userEmail && !!userName
		} catch {
			return false
		}
	}

	private async checkIsGitRepository(): Promise<boolean> {
		try {
			const { stdout } = await execa("git", ["rev-parse", "--is-inside-work-tree"], { cwd: this.repoPath })
			return stdout.trim() === "true"
		} catch {
			return false
		}
	}

	private async getLocalConfigValue(key: string): Promise<string | null> {
		try {
			const { stdout } = await execa("git", ["config", key], { cwd: this.repoPath })
			return stdout.trim()
		} catch (error) {
			console.error(`Error getting git config ${key}: ${error}`)
			return null
		}
	}

	static async getFileContent(repoPath: string, filePath: string, commitHash: string): Promise<string | null> {
		try {
			const { stdout } = await execa("git", ["show", `${commitHash}:${filePath}`], { cwd: repoPath })
			return stdout
		} catch (error) {
			console.error(`Error getting file content: ${error}`)
			return null
		}
	}
}
