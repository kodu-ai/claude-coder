/**
 * Unified tool calling format template
 * This provides a consistent way to define how tools should be called by LLMs
 */

/**
 * XML format tool call template
 * All tools should use this same format for consistency
 */
export const xmlToolCallTemplate = {
  // Format for Claude 3.5 Sonnet
  standard: '<tool name="{toolName}">\n{parameters}\n</tool>',
  
  // Format for Claude 3 Opus/Haiku
  legacy: '<{toolName}>\n{parameters}\n</{toolName}>',
  
  // Format parameter (single)
  parameter: '  <{paramName}>{paramValue}</{paramName}>',
  
  // Format for nested parameters
  nestedParameter: '  <{paramName}>\n{nestedParameters}\n  </{paramName}>',
  
  // Format nested parameter item 
  nestedParameterItem: '    <{paramName}>{paramValue}</{paramName}>'
}

/**
 * Generates tool call examples in both formats
 * @param toolName The name of the tool
 * @param examples Array of parameter examples
 */
export function generateToolCallExamples(
  toolName: string, 
  examples: Array<Record<string, string | number | boolean>>
): string[] {
  return examples.map(example => {
    const params = Object.entries(example)
      .map(([key, value]) => xmlToolCallTemplate.parameter
        .replace('{paramName}', key)
        .replace('{paramValue}', String(value))
      )
      .join('\n')
      
    return xmlToolCallTemplate.standard
      .replace('{toolName}', toolName)
      .replace('{parameters}', params)
  })
}

/**
 * Generates the unified tool call format for tool definitions
 */
export function defineToolCallFormat(toolName: string) {
  return {
    name: toolName,
    callFormat: {
      xml: {
        standard: xmlToolCallTemplate.standard.replace('{toolName}', toolName),
        legacy: xmlToolCallTemplate.legacy.replace('{toolName}', toolName)
      }
    }
  }
}