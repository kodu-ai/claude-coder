import { 
  toolDefinitions, 
  getAllToolExamples,
  getToolDefinition,
  getToolCallFormat
} from '../definitions'

/**
 * Generates tool documentation for the system prompt
 * This creates a formatted string that describes all available tools
 * with their parameters, examples, and capabilities
 */
export function generateToolDocumentation(): string {
  return toolDefinitions
    .map(tool => {
      const { name, prompt } = tool
      const format = getToolCallFormat(name)
      
      // Basic tool description
      let doc = `## ${name}\n\n${prompt.description}\n\n`
      
      // Add parameters section
      doc += `**Parameters:**\n`
      Object.entries(prompt.parameters).forEach(([paramName, param]) => {
        const required = param.required ? '(required)' : '(optional)'
        doc += `- \`${paramName}\`: ${param.description} ${required}\n`
        
        // Add enum values if available
        if (param.enum) {
          doc += `  - Allowed values: ${param.enum.map(v => `\`${v}\``).join(', ')}\n`
        }
        
        // Add default value if available
        if (param.default !== undefined) {
          doc += `  - Default: \`${param.default}\`\n`
        }
      })
      
      // Add capabilities section
      if (prompt.capabilities && prompt.capabilities.length > 0) {
        doc += `\n**Capabilities:**\n`
        prompt.capabilities.forEach(capability => {
          doc += `- ${capability}\n`
        })
      }
      
      // Add XML format examples
      doc += `\n**Format:**\n\`\`\`xml\n${format?.xml.standard.replace('{parameters}', '  <param>value</param>')}\n\`\`\`\n\n`
      
      // Add example usage
      if (prompt.examples && prompt.examples.length > 0) {
        doc += `**Example:**\n\`\`\`xml\n${prompt.examples[0].output}\n\`\`\`\n\n`
      }
      
      return doc
    })
    .join('\n---\n\n')
}

/**
 * Generates a section of example tool calls for the system prompt
 */
export function generateToolExamples(): string {
  const examples = getAllToolExamples()
  
  // Only include a subset of examples to keep the prompt size reasonable
  const selectedExamples = examples
    .filter((_, index) => index % 2 === 0) // Only include every other example
    .slice(0, 10) // Maximum 10 examples
  
  return selectedExamples
    .map(example => {
      return `### ${example.description}\n\`\`\`xml\n${example.format}\n\`\`\`\n\n`
    })
    .join('')
}

/**
 * Generates the complete tools section for the system prompt
 * This includes an overview, general format, and all tool documentation
 */
export function generateToolsSystemPrompt(): string {
  return `
# Available Tools

You have access to the following tools to help you complete tasks. Use these tools to interact with the environment, read files, execute commands, and more.

## General Tool Format

Tools are called using a standardized XML format:

\`\`\`xml
<tool name="tool_name">
  <parameter1>value1</parameter1>
  <parameter2>value2</parameter2>
</tool>
\`\`\`

## Tool Usage Guidelines

1. **Use the appropriate tool** for each task
2. **Provide all required parameters** in the correct format
3. **Wait for tool execution** to complete before proceeding
4. **Handle errors gracefully** if a tool fails

## Tool Examples

${generateToolExamples()}

## Tool Reference

${generateToolDocumentation()}
`
}