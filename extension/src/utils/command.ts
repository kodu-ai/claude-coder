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
		await sidebarProvider.getStateManager().setGitHandlerEnabled(false)
		await sidebarProvider.getStateManager()
			.setCustomInstructions(`You should pay extra attentiong to the user messages, try to avoid looping, think about the root cause of the problem and try to solve it.
			If the user mentions a <pr_issue>, you should try to understand the root cause of the <pr_issue> and solve it.
			Also it's extremely useful to find the correct test cases for the problem you are solving, so you can run that individual test case instead of the whole test suite, if it's possible in case it's not possible to run the individual test case, you should run the whole test suite.
			Try to familiarize yourself with the codebase, so you can understand the codebase better and solve the problem faster.
			Try to gather as much context before starting to solve the problem, gather context is an extremely important step to solve the problem faster and more efficiently.
			Sometimes you are required to fix the root cause of the problem and sometimes you just need a hotfix to solve the problem, make sure you understand the difference between them and act accordingly.
			Remember to test your code before submitting the solution, it's important to test your code to make sure it's working as expected.
			Lastly and very importantly try to make as minimal changes as possible to the codebase to solve the problem and don't add random unrelated changes to the codebase this is an enterprise codebase and we need to keep it clean and maintainable and not introduce unnecessary changes that dosent fit the task or the pr_issue you are solving.
			`)

		await sidebarProvider.getGlobalStateManager().updateGlobalState("gitHandlerEnabled", false)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("autoSummarize", true)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("terminalCompressionThreshold", 3_000)
		await sidebarProvider.getGlobalStateManager().updateGlobalState("commandTimeout", 360)
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
