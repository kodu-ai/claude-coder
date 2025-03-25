# Unified Tool Definitions

This directory contains unified definitions for all tools used in the Claude Dev agent system. Each tool definition combines:

1. **Schema** - Zod schema for validation
2. **Types** - TypeScript types derived from the schema 
3. **Prompt Information** - Descriptions, capabilities, and examples for LLM consumption
4. **Calling Format** - Standardized XML format for tool invocation

## Architecture

The unified tool definitions provide a single source of truth for each tool, ensuring consistency between:
- Runtime validation (Zod schema)
- Type safety (TypeScript types)
- LLM instructions (prompt definitions)
- Tool invocation format (XML template)

### Key Components

- **tool-call-template.ts** - Defines the XML template format and helpers
- **index.ts** - Registry of all tool definitions with helper functions
- **{tool-name}.tool.ts** - Individual tool definitions

## XML Tool Calling Format

All tools use a consistent XML format:

```xml
<tool name="tool_name">
  <parameter1>value1</parameter1>
  <parameter2>value2</parameter2>
</tool>
```

This provides Claude with a standardized way to invoke tools.

## Usage

1. **Adding a new tool**:
   - Create a new file `{tool-name}.tool.ts`
   - Define the schema, types, and prompt information
   - Register it in `index.ts`

2. **Fetching tool information**:
   - `getToolDefinition(name)` - Get a specific tool definition
   - `getToolCallFormat(name)` - Get XML format for a specific tool
   - `getAllToolExamples()` - Get examples for system prompts

## Tool List

The system currently provides definitions for the following tools:

- `read_file` - Read file contents
- `search_files` - Search for files with a pattern
- `execute_command` - Execute a shell command
- `list_files` - List files in a directory
- `file_editor` - Edit file contents
- `ask_followup_question` - Ask a clarifying question
- `search_symbol` - Search for code symbols
- `url_screenshot` - Take a screenshot of a URL
- `attempt_completion` - Attempt to complete a task
- `explore_repo_folder` - Explore a repository folder
- `spawn_agent` - Create a new agent
- `exit_agent` - Exit the current agent
- `server_runner` - Run a development server
- `web_search` - Search the web for information
- `write_to_file` - Write content to a file
- `add_interested_file` - Track files relevant to the task
- `file_changes_plan` - Plan file changes
- `submit_review` - Submit a review of progress
- `reject_file_changes` - Reject proposed file changes

## Integration

This unified architecture integrates with:
- Tool execution logic in `/agent/v1/tools/runners/`
- Tool schema validation in `/agent/v1/tools/schema/`
- System prompt generation in `/agent/v1/prompts/tools/`