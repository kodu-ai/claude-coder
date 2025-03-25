// schema/index.ts
import { executeCommandTool } from "./execute_command"
import { listFilesTool } from "./list_files"
import { ExploreRepoFolderTool } from "./explore-repo-folder.schema"
import { searchFilesTool } from "./search_files"
import { readFileTool } from "./read_file"
import { writeToFileTool } from "./write_to_file"
import { askFollowupQuestionTool } from "./ask_followup_question"
import { attemptCompletionTool } from "./attempt_completion"
import { webSearchTool } from "./web_search"
import { urlScreenshotTool } from "./url_screenshot"
import { devServerTool } from "./dev_server"
import { searchSymbolTool } from "./search_symbols"
import { addInterestedFileTool } from "./add_interested_file"
import { fileEditorTool } from "./file_editor_tool"
import { spawnAgentTool } from "./agents/agent-spawner"
import { exitAgentTool } from "./agents/agent-exit"
import { sequentialThinkingTool } from "./sequential_thinking"

export const tools = [
	executeCommandTool,
	listFilesTool,
	ExploreRepoFolderTool,
	searchFilesTool,
	readFileTool,
	askFollowupQuestionTool,
	attemptCompletionTool,
	webSearchTool,
	urlScreenshotTool,
	devServerTool,
	searchSymbolTool,
	addInterestedFileTool,
	fileEditorTool,
	spawnAgentTool,
	exitAgentTool,
] as const

export type Tool = (typeof tools)[number]
export {
	executeCommandTool,
	listFilesTool,
	ExploreRepoFolderTool,
	searchFilesTool,
	readFileTool,
	writeToFileTool,
	askFollowupQuestionTool,
	attemptCompletionTool,
	webSearchTool,
	urlScreenshotTool,
	searchSymbolTool as searchSymbolsTool,
	addInterestedFileTool,
	fileEditorTool,
	spawnAgentTool as subAgentTool,
	exitAgentTool as exitSubAgentTool,
}
