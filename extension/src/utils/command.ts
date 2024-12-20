import { ExtensionProvider } from "../providers/claude-coder/claude-coder-provider"
import * as dotenv from "dotenv"
import * as path from "path"
import * as vscode from "vscode"
import { koduDefaultModelId } from "../shared/api"
import { execa } from "execa"

var currentCommit = ""

const getCurrentGitCommit = async () => {
	const { stdout } = await execa("git", ["rev-parse", "HEAD"])
	currentCommit = stdout
	return stdout
}

export const hardRollbackToStart = async () => {
	// roll back to current commit
	await execa("git", ["reset", "--hard", currentCommit])
}

export const startNewTask = async (
	context: vscode.ExtensionContext,
	sidebarProvider: ExtensionProvider,
	task: string
) => {
	const parsedConfig = dotenv.config({ path: path.join(context.extensionPath, ".env") })
	console.log(`[DEBUG] Parsed config: ${parsedConfig}, here is the task: ${task}`)

	if (parsedConfig.parsed?.KODU_API_KEY) {
		sidebarProvider.getApiManager().saveKoduApiKey(parsedConfig.parsed.KODU_API_KEY)
		try {
			currentCommit = await getCurrentGitCommit()
		} catch (err) {
			console.log(`[ERROR] Error getting current commit: ${err}`)
		}
		console.log(`[DEBUG] Current Commit: ${currentCommit}`)
		await sidebarProvider.getApiManager().updateApiConfiguration({
			koduApiKey: parsedConfig.parsed.KODU_API_KEY!,
			apiModelId: koduDefaultModelId,
		})

		await sidebarProvider.getStateManager().setAlwaysAllowReadOnly(true)
		await sidebarProvider.getStateManager().setAlwaysAllowWriteOnly(true)
		await sidebarProvider.getStateManager().setInlineEditModeType("full")
		await sidebarProvider.getStateManager().setTerminalCompressionThreshold(3_000)
		await sidebarProvider.getStateManager().setAutoSummarize(true)
		await sidebarProvider.getStateManager().setGitHandlerEnabled(false)
		// await sidebarProvider.getStateManager()
		// 	.setCustomInstructions(`You must pay close attention to the user's instructions and the given issue in the PR).
		// Before making changes, deeply understand the root cause of the problem. Determine whether you need a deep fix (root cause correction) or just a minimal hotfix, and always choose the minimal but correct approach.

		// Familiarize yourself with the codebase before attempting a fix. Explore the repository structure, understand the related code paths, and identify where the problem might lie. Seek out the specific code segment that causes the observed bug.

		// Create reproduction script of the issue using multiple test cases that include edge cases and tests that confirm if the root issue was solved or not.
		// Use that script to confirm the presence of the bug initially and later to verify that your fix resolves it.

		// Avoid unnecessary loops or repetitive attempts. If you find yourself stuck and making the same changes repeatedly without progress, pause and rethink your strategy. Reassess the root cause of the issue and consider a different approach.

		// Run individual tests when you can, but if not possible, run the full test suite. Always test your changes before finalizing. After you believe you've fixed the issue, run the test suite again to ensure there are no regressions. Achieving zero regressions in the test suite is mandatory.

		// When done, only raise \`attempt_completion\` if:
		// 1. Your bug reproduction script shows the bug is fixed.
		// 2. You have run the entire test suite and confirmed zero regressions.
		// 3. You have made minimal, targeted changes that solve the root cause.

		// Always reflect on your work: is the fix minimal, does it solve the problem at its source, and does it maintain or improve the code quality? If yes, then finalize your solution.
		// `)

		await sidebarProvider.getGlobalStateManager().updateGlobalState("gitHandlerEnabled", false)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("autoSummarize", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("terminalCompressionThreshold", 3_000)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("commandTimeout", 90)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("inlineEditOutputType", "full")
		await sidebarProvider.getGlobalStateManager().updateGlobalState("alwaysAllowReadOnly", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("alwaysAllowWriteOnly", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("autoCloseTerminal", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("skipWriteAnimation", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("lastShownAnnouncementId", "dummy")
	}

	sidebarProvider.getTaskManager().handleNewTask(task)
}
