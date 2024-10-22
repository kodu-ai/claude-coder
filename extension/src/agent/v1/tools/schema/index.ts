import { askConsultantTool } from './ask_consultant'
import { askFollowupQuestionTool } from './ask_followup_question'
import { attemptCompletionTool } from './attempt_completion'
import { devServerTool } from './dev_server'
// schema/index.ts
import { executeCommandTool } from './execute_command'
import { listCodeDefinitionNamesTool } from './list_code_definition_names'
import { listFilesTool } from './list_files'
import { readFileTool } from './read_file'
import { searchFilesTool } from './search_files'
import { upsertMemoryTool } from './upsert_memory'
import { urlScreenshotTool } from './url_screenshot'
import { webSearchTool } from './web_search'
import { writeToFileTool } from './write_to_file'

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
