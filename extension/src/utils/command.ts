import * as path from "path"
import * as dotenv from "dotenv"
import * as vscode from "vscode"
import { ExtensionProvider } from "@/providers/claude-coder/ClaudeCoderProvider"
import { koduDefaultModelId } from "../shared/api"

export const startNewTask = async (
	context: vscode.ExtensionContext,
	sidebarProvider: ExtensionProvider,
	task: string
) => {
	const parsedConfig = dotenv.config({ path: path.join(context.extensionPath, ".env") })

	if (parsedConfig.parsed?.KODU_API_KEY) {
		sidebarProvider.getApiManager().saveKoduApiKey(parsedConfig.parsed.KODU_API_KEY)

		await sidebarProvider.getApiManager().updateApiConfiguration({
			koduApiKey: parsedConfig.parsed.KODU_API_KEY!,
			apiModelId: koduDefaultModelId,
		})

		await sidebarProvider.getStateManager().setTechnicalBackground("developer")
		await sidebarProvider.getStateManager().setAlwaysAllowReadOnly(true)
		await sidebarProvider.getStateManager().setAlwaysAllowWriteOnly(true)
		await sidebarProvider.getStateManager().setIsContinueGenerationEnabled(true)

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
