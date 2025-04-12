/**
 * Utility to generate tool prompts from unified tool definitions
 * This allows prompts to be generated directly from the source of truth
 */

import { toolDefinitions } from '../definitions'
import { ToolPromptSchema } from '../../prompts/utils/utils'

/**
 * Generate prompt definitions for all tools
 * These can be imported in the prompts directory
 */
export function generateToolPrompts(): Record<string, ToolPromptSchema> {
  const prompts: Record<string, ToolPromptSchema> = {}
  
  for (const tool of toolDefinitions) {
    prompts[tool.name] = tool.prompt as ToolPromptSchema
  }
  
  return prompts
}

/**
 * Get a specific tool prompt definition
 */
export function getToolPrompt(name: string): ToolPromptSchema | undefined {
  const tool = toolDefinitions.find(t => t.name === name)
  return tool?.prompt as ToolPromptSchema
}