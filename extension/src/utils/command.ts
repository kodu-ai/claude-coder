import { ExtensionProvider } from "../providers/claude-coder/claude-coder-provider"
import * as dotenv from "dotenv"
import * as path from "path"
import * as vscode from "vscode"
import { koduDefaultModelId } from "../shared/api"
import { execa } from "execa"
import dedent from "dedent"

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
		await sidebarProvider.getStateManager()
			.setCustomInstructions(dedent`We are now switching to github pull request issue solving, our main goal is to solve the github pull request issue ticket with causing regression or any other issues and making targeted changes that are necessary to solve the issue.
		You must pay close attention to the user's instructions in <task>.
		Before making changes, deeply understand the root cause of the problem. Determine whether you need a deep fix (root cause correction) or just a minimal hotfix, and always choose the minimal but correct approach.
		You are running fully autonomously, so you must be very careful with your changes. You can't ask for help or ask_followup_questions tool.
		`)

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
