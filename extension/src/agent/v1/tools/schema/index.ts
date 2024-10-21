// schema/index.ts
import { executeCommandTool } from "./execute_command"
import { listFilesTool } from "./list_files"
import { listCodeDefinitionNamesTool } from "./list_code_definition_names"
import { searchFilesTool } from "./search_files"
import { readFileTool } from "./read_file"
import { writeToFileTool } from "./write_to_file"
import { askFollowupQuestionTool } from "./ask_followup_question"
import { attemptCompletionTool } from "./attempt_completion"
import { webSearchTool } from "./web_search"
import { urlScreenshotTool } from "./url_screenshot"
import { askConsultantTool } from "./ask_consultant"
import { upsertMemoryTool } from "./upsert_memory"
import { devServerTool } from "./dev_server"

export const tools = [
	executeCommandTool,
	listFilesTool,
	listCodeDefinitionNamesTool,
	searchFilesTool,
	readFileTool,
	writeToFileTool,
	askFollowupQuestionTool,
	attemptCompletionTool,
	webSearchTool,
	urlScreenshotTool,
	askConsultantTool,
	upsertMemoryTool,
	devServerTool,
] as const

export type Tool = (typeof tools)[number]
export {
	executeCommandTool,
	listFilesTool,
	listCodeDefinitionNamesTool,
	searchFilesTool,
	readFileTool,
	writeToFileTool,
	askFollowupQuestionTool,
	attemptCompletionTool,
	webSearchTool,
	urlScreenshotTool,
	askConsultantTool,
	upsertMemoryTool,
}
