import { execa, ExecaError } from "execa"
import { promises as fs } from "fs"
import { GitBranchItem, GitLogItem } from "../../../shared/ExtensionMessage"
import { StateManager } from "../state-manager"
import { ApiManager } from "../api-handler"
import { ApiConfiguration } from "../../../api"

// Custom error class for better error handling
export class GitHandlerError extends Error {
    constructor(message: string, public readonly command?: string) {
        super(message);
        this.name = 'GitHandlerError';
    }
}

// Logger interface for consistent logging
interface GitLogger {
    info(message: string): void;
    error(message: string, error?: unknown): void;
    debug(message: string): void;
}

export type GitCommitResult = {
	branch: string
	commitHash: string
}

const COMMIT_MESSAGE_PROMPT = `Generate a concise and descriptive commit message following the Conventional Commits specification (https://www.conventionalcommits.org/).
The message should be in the format: <type>(<scope>): <description>

Given the following git diff and file information, generate an appropriate commit message:

File: {filePath}
Diff:
{diff}

The commit message should:
1. Use appropriate type (feat, fix, docs, style, refactor, perf, test, chore)
2. Include scope when relevant
3. Have a clear, concise description
4. Focus on the "what" and "why" rather than the "how"
5. Be written in imperative mood

Respond with ONLY the commit message, nothing else.`

export class GitHandler {
	private repoPath: string | undefined
	private readonly DEFAULT_USER_NAME = "kodu-ai"
	private readonly DEFAULT_USER_EMAIL = "bot@kodu.ai"
	private stateManager: StateManager
	private readonly logger: GitLogger = console;
	private apiManager: ApiManager;

	constructor(repoPath: string, stateManager: StateManager, apiManager: ApiManager) {
		this.repoPath = repoPath
		this.stateManager = stateManager
		this.apiManager = apiManager
	}

	private checkEnabled(): boolean {
		if (!this.stateManager.gitHandlerEnabled) {
			console.log("Git handler is disabled")
			return false
		}
		return true
	}

	async init(): Promise<boolean> {
		if (!this.repoPath || !this.checkEnabled()) {
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

			return true
		} catch (error) {
			console.error(`Error initializing git repository: ${error}`)
			return false
		}
	}

	async commitEverything(message: string): Promise<GitCommitResult> {
		if (!this.checkEnabled()) {
			throw new Error("Git handler is disabled")
		}
		try {
			await this.prepareForCommit()
			return this.commitWithMessage(".", message)
		} catch (error) {
			throw new Error(`Error committing changes: ${error}`)
		}
	}

	async commitOnFileWrite(path: string): Promise<GitCommitResult> {
		if (!this.checkEnabled()) {
			throw new Error("Git handler is disabled")
		}
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
			throw new GitHandlerError("Git is not installed")
		}

		if (!(await this.isRepositorySetup())) {
			const isSetup = await this.setupRepository()
			if (!isSetup) {
				throw new GitHandlerError("Failed to setup repository")
			}
		}
	}

	private async withRetry<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
		let lastError;
		for (let i = 0; i < retries; i++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error;
				this.logger.debug(`Retry ${i + 1}/${retries} failed: ${error}`);
				await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
			}
		}
		throw lastError;
	}

	async getStatus(): Promise<{
		isClean: boolean;
		modified: string[];
		untracked: string[];
	}> {
		if (!this.checkEnabled()) {
			throw new GitHandlerError("Git handler is disabled");
		}

		const { stdout } = await this.withRetry(() =>
			execa("git", ["status", "--porcelain"], { cwd: this.repoPath })
		);

		const modified: string[] = [];
		const untracked: string[] = [];

		stdout.split("\n").filter(Boolean).forEach(line => {
			const status = line.substring(0, 2);
			const file = line.substring(3);
			if (status.includes("??")) {
				untracked.push(file);
			} else {
				modified.push(file);
			}
		});

		return {
			isClean: stdout === "",
			modified,
			untracked
		};
	}

	async stashChanges(message?: string): Promise<boolean> {
		if (!this.checkEnabled()) {
			throw new GitHandlerError("Git handler is disabled");
		}

		try {
			const args = ["stash", "push"];
			if (message) {
				args.push("-m", message);
			}
			await this.withRetry(() => execa("git", args, { cwd: this.repoPath }));
			return true;
		} catch (error) {
			this.logger.error("Error stashing changes:", error);
			return false;
		}
	}

	private async isProtectedBranch(branchName: string): Promise<boolean> {
		const protectedBranches = ["main", "master", "develop"];
		if (protectedBranches.includes(branchName)) {
			return true;
		}
		return false;
	}

	private async commitWithMessage(path: string, message: string): Promise<GitCommitResult> {
		try {
			// Separate add and commit for better error handling
			await execa("git", ["add", path], { cwd: this.repoPath })
			const { stdout } = await execa(
				"git",
				["commit", "--author", `${this.DEFAULT_USER_NAME} <${this.DEFAULT_USER_EMAIL}>`, "-m", message],
				{ cwd: this.repoPath }
			)
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
		try {
			const { stdout } = await execa("git", ["diff", "--cached", "--unified=0", path], { cwd: this.repoPath })
			
			// Create the prompt by replacing placeholders in COMMIT_MESSAGE_PROMPT
			const prompt = COMMIT_MESSAGE_PROMPT
				.replace("{filePath}", path)
				.replace("{diff}", stdout)

			// Use ApiManager to generate commit message using LLM
			const stream = await this.apiManager.createApiStreamRequest([{
				role: "user",
				content: [{
					type: "text",
					text: prompt
				}]
			}])

			let commitMessage = ""
			for await (const chunk of stream) {
				if (chunk.code === 1 && chunk.body?.anthropic?.content?.[0]) {
					const content = chunk.body.anthropic.content[0]
					if ('type' in content && content.type === 'text') {
						commitMessage = content.text.trim()
						break
					}
				}
			}

			// If LLM fails to generate a message, fall back to rule-based generation
			if (!commitMessage) {
				const prefix = this.getCommitPrefix(path, stdout)
				const scope = this.getCommitScope(path)
				const description = this.generateCommitDescription(path, stdout)
				return scope ? `${prefix}(${scope}): ${description}` : `${prefix}: ${description}`
			}

			return commitMessage
		} catch (error) {
			console.error(`Error generating commit message: ${error}`)
			return `chore: update ${this.getFileNameFromPath(path)}`
		}
	}

	private getCommitPrefix(path: string, diff: string): string {
		// Configuration changes
		if (path.match(/\.(json|yaml|yml|toml|ini)$/i)) {
			return 'config'
		}

		// Test files
		if (path.includes('test/') || path.match(/\.(test|spec)\.(ts|js|tsx|jsx)$/)) {
			return 'test'
		}

		// Documentation
		if (path.endsWith('.md') || path.includes('/docs/')) {
			return 'docs'
		}

		// Dependencies
		if (path.match(/package(-lock)?\.json$/) || path.match(/yarn\.lock$/)) {
			return 'deps'
		}

		// Check diff content for semantic hints
		const diffContent = diff.toLowerCase()
		if (diffContent.includes('fix:') || diffContent.includes('bug:') || diffContent.includes('issue:')) {
			return 'fix'
		}
		if (diffContent.includes('refactor:') || diffContent.includes('clean:')) {
			return 'refactor'
		}
		if (diffContent.includes('perf:') || diffContent.includes('performance:')) {
			return 'perf'
		}
		if (diffContent.includes('style:') || diffContent.match(/^\+\s*[\t ]*$/m)) {
			return 'style'
		}

		// New files are features by default
		if (!diff.includes("--- a/")) {
			return 'feat'
		}

		// Default to chore for maintenance tasks
		return 'chore'
	}

	private getCommitScope(path: string): string | null {
		// Extract meaningful scope from file path
		const parts = path.split('/')

		// Handle special cases first
		if (path.includes('test/')) {
			return 'tests'
		}
		if (path.includes('docs/')) {
			return 'docs'
		}
		if (path.match(/\.(test|spec)\.(ts|js|tsx|jsx)$/)) {
			return 'tests'
		}

		// Extract scope from directory structure
		if (parts.length > 1) {
			// Use the first meaningful directory as scope
			const scopeDirs = parts.filter(part => 
				!part.match(/^(src|lib|app|dist|build|public)$/) && 
				!part.match(/\.[a-z]+$/)
			)
			if (scopeDirs.length > 0) {
				return scopeDirs[0]
			}
		}

		return null
	}

	private generateCommitDescription(path: string, diff: string): string {
		const fileName = this.getFileNameFromPath(path)
		const isNewFile = !diff.includes("--- a/")

		if (isNewFile) {
			return `add ${fileName}`
		}

		// Analyze diff to generate meaningful description
		const changes = this.analyzeChanges(diff)
		if (changes.significant) {
			return `${changes.action} ${fileName}`
		}

		return `update ${fileName}`
	}

	private getFileNameFromPath(path: string): string {
		return path.split('/').pop() || path
	}

	private analyzeChanges(diff: string): { action: string; significant: boolean } {
		const addedLines = (diff.match(/^\+(?!\+\+)/gm) || []).length
		const deletedLines = (diff.match(/^-(?!--)/gm) || []).length
		const totalChanges = addedLines + deletedLines

		// Determine if changes are significant (more than just formatting)
		const significant = totalChanges > 5 || diff.includes('class ') || diff.includes('function ')

		if (addedLines > 0 && deletedLines > 0) {
			return {
				action: significant ? 'refactor' : 'modify',
				significant
			}
		} else if (addedLines > deletedLines) {
			return {
				action: significant ? 'implement' : 'enhance',
				significant
			}
		} else if (deletedLines > addedLines) {
			return {
				action: significant ? 'remove' : 'cleanup',
				significant
			}
		}

		return {
			action: 'update',
			significant: false
		}
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

	static async getLog(repoAbsolutePath: string, limit = 100): Promise<GitLogItem[]> {
		if (!repoAbsolutePath) {
			return []
		}

		try {
			const { stdout } = await execa(
				"git",
				[
					"log",
					`-n ${limit}`,
					"--pretty=format:%h%x09%ad%x09%s",
					"--date=format:%Y-%m-%d %H:%M",
					"--no-merges"
				],
				{
					cwd: repoAbsolutePath,
					maxBuffer: 1024 * 1024 // Increase buffer size for large repos
				}
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
		if (!this.repoPath || !this.checkEnabled()) {
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
		if (!this.repoPath || !this.checkEnabled()) {
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
		if (!this.repoPath || !this.checkEnabled()) {
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
		if (!this.repoPath || !this.checkEnabled()) {
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
		if (!this.repoPath || !this.checkEnabled()) {
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
		if (!this.repoPath || !this.checkEnabled()) {
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