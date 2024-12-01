import { ExtensionProvider } from "@/providers/claude-coder/ClaudeCoderProvider"
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
			It will help you understand the root cause of the problem and solve it.
			You should always aim to solve the root cause of the problem, not just the symptoms.
			The most important part is to include a very detailed <thinking> tag in every response. This will help you self reflect on your thought process and improve your problem solving skills as the conversation progresses.
			Every few messages you should take a moment to self reflect inside your <thinking> tag.
			A good example of self reflection will be:
			<thinking>
			I see i'm stuck editing the same time without making significant improvements. I should take a step back and think about the root cause of the problem.
			let me start self reflecting on my thought process and see if i can find a better solution.
			<self_reflection>
			... self reflection content at least 10 sentences think step by step about what you are doing and the problem in hand, remember you are trying to solve the root cause of the problem.
			</self_reflection>
			</thinking>

			The more you reflect on your thought process, the better you will become at problem solving, some tasks requires a lot of iterations to solve, so don't be hasty, take your time and think about the problem in hand.
			If you think you solved the problem after 3-4 iterations, you are probably wrong, there is a strong chance that you are solving the symptoms not the root cause of the problem.
			Great problem solvers are not hasty, they take their time to understand the problem and solve it from the root cause.
			But one last good pointer to note Sometimes hotfix / quick fix is what you need to do to solve the problem efficiently, not everything requires a deep refactor you should figure out when to do a quick fix and when to do a deep refactor on your own.
			`)

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
