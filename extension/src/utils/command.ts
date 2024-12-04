import { ExtensionProvider } from "../providers/claude-coder/ClaudeCoderProvider"
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

		await sidebarProvider.getStateManager().setTechnicalBackground("developer")
		await sidebarProvider.getStateManager().setAlwaysAllowReadOnly(true)
		await sidebarProvider.getStateManager().setAlwaysAllowWriteOnly(true)
		await sidebarProvider.getStateManager().setIsContinueGenerationEnabled(true)
		await sidebarProvider.getStateManager().setInlineEditMode(true)
		await sidebarProvider.getStateManager().setInlineEditModeType("full")
		await sidebarProvider.getStateManager().setTerminalCompressionThreshold(3_000)
		await sidebarProvider.getStateManager().setAutoSummarize(true)
		await sidebarProvider.getStateManager()
			.setCustomInstructions(`You should pay extra attentiong to the user messages, try to avoid looping, think about the root cause of the problem and try to solve it.
			If the user mentions a <pr_issue>, you should try to understand the root cause of the <pr_issue> and solve it.
			`)

		await sidebarProvider.getGlobalStateManager().updateGlobalState("autoSummarize", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("terminalCompressionThreshold", 3_000)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("commandTimeout", 180)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("inlineEditOutputType", "full")
		await sidebarProvider.getGlobalStateManager().updateGlobalState("isInlineEditingEnabled", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("alwaysAllowReadOnly", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("alwaysAllowWriteOnly", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("autoCloseTerminal", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("shouldShowKoduPromo", false)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("skipWriteAnimation", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("lastShownAnnouncementId", "dummy")
		await sidebarProvider.getGlobalStateManager().updateGlobalState("isInlineEditingEnabled", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("isContinueGenerationEnabled", true)
	}

	sidebarProvider.getTaskManager().handleNewTask(task)
}
