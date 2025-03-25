/**
 * Central registry for all unified tool definitions
 * Each tool definition combines schema, prompt, and type information
 * with a consistent calling format
 */

// Import all tool definitions
import { readFileTool } from './read-file.tool'
import { searchFilesTool } from './search-files.tool'
import { executeCommandTool } from './execute-command.tool'
import { listFilesTool } from './list-files.tool'
import { fileEditorTool } from './file-editor.tool'
import { askFollowupQuestionTool } from './ask-followup-question.tool'
import { searchSymbolTool } from './search-symbol.tool'
import { urlScreenshotTool } from './url-screenshot.tool'
import { attemptCompletionTool } from './attempt-completion.tool'
import { exploreRepoFolderTool } from './explore-repo-folder.tool'
import { spawnAgentTool } from './spawn-agent.tool'
import { exitAgentTool } from './exit-agent.tool'
import { serverRunnerTool } from './server-runner.tool'
import { webSearchTool } from './web-search.tool'
import { writeToFileTool } from './write-to-file.tool'
import { addInterestedFileTool } from './add-interested-file.tool'
import { fileChangePlanTool } from './file-change-plan.tool'
import { submitReviewTool } from './submit-review.tool'
import { rejectFileChangesTool } from './reject-file-changes.tool'

// Export individual tool definitions
export * from './tool-call-template'
export * from './read-file.tool'
export * from './search-files.tool'
export * from './execute-command.tool'
export * from './list-files.tool'
export * from './file-editor.tool'
export * from './ask-followup-question.tool'
export * from './search-symbol.tool'
export * from './url-screenshot.tool'
export * from './attempt-completion.tool'
export * from './explore-repo-folder.tool'
export * from './spawn-agent.tool'
export * from './exit-agent.tool'
export * from './server-runner.tool'
export * from './web-search.tool'
export * from './write-to-file.tool'
export * from './add-interested-file.tool'
export * from './file-change-plan.tool'
export * from './submit-review.tool'
export * from './reject-file-changes.tool'

// Export a registry of all tools
export const toolDefinitions = [
  readFileTool,
  searchFilesTool,
  executeCommandTool,
  listFilesTool,
  fileEditorTool,
  askFollowupQuestionTool,
  searchSymbolTool,
  urlScreenshotTool,
  attemptCompletionTool,
  exploreRepoFolderTool,
  spawnAgentTool,
  exitAgentTool,
  serverRunnerTool,
  webSearchTool,
  writeToFileTool,
  addInterestedFileTool,
  fileChangePlanTool,
  submitReviewTool,
  rejectFileChangesTool
]

// Tool registry type
export type ToolName = typeof toolDefinitions[number]['name']

// Helper to get a tool definition by name
export function getToolDefinition(name: string) {
  return toolDefinitions.find(tool => tool.name === name)
}

/**
 * Get the XML calling format for a specific tool
 * This provides a consistent way for LLMs to call tools
 */
export function getToolCallFormat(toolName: string) {
  const tool = getToolDefinition(toolName)
  return tool?.callFormat || null
}

/**
 * Extract all tool examples for use in the system prompt
 */
export function getAllToolExamples() {
  return toolDefinitions.flatMap(tool => 
    tool.examples.map(example => ({
      toolName: tool.name,
      description: example.description,
      format: example.output
    }))
  )
}