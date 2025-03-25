# Migration Plan: Unified Tool Definitions

This document outlines the steps to migrate from the existing separate tool definitions in `/schema` and `/prompts/tools` to the new unified architecture in `/definitions`.

## Overview

The migration involves:

1. Replacing schema imports with unified definition imports
2. Updating the ToolExecutor to use the new definitions
3. Modifying the ToolParser to work with the unified format
4. Updating tool runners to reference the new definitions
5. Integrating the system prompt generator

## Detailed Steps

### 1. Update Tool Executor

The `tool-executor.ts` file needs to be modified to use the new unified definitions:

```typescript
// Replace this import
import { tools, writeToFileTool } from "./schema"

// With this import
import { toolDefinitions, writeToFileTool } from "./definitions"

// Update the ToolParser initialization
this.toolParser = new ToolParser(
  toolDefinitions.map((tool) => ({ name: tool.name, schema: tool.schema })),
  {
    onToolUpdate: this.handleToolUpdate.bind(this),
    onToolEnd: this.handleToolEnd.bind(this),
    onToolError: this.handleToolError.bind(this),
  }
)

// Make the createTool method more dynamic
private createTool(params: FullToolParams<any>) {
  const toolName = params.name as ToolName;
  
  // Define the mapping of tool names to their implementation classes
  const toolImplementations = {
    read_file: ReadFileTool,
    search_files: SearchFilesTool,
    execute_command: ExecuteCommandTool,
    list_files: ListFilesTool,
    file_editor: FileEditorTool,
    ask_followup_question: AskFollowupQuestionTool,
    search_symbol: SearchSymbolTool,
    url_screenshot: UrlScreenshotTool,
    attempt_completion: AttemptCompletionTool,
    explore_repo_folder: ExploreRepoFolderTool,
    spawn_agent: SpawnAgentTool,
    exit_agent: ExitAgentTool,
    server_runner: ServerRunnerTool,
    web_search: WebSearchTool,
    write_to_file: WriteToFileTool,
    add_interested_file: AddInterestedFileTool,
    file_changes_plan: FileChangePlanTool,
    submit_review: SubmitReviewTool,
    reject_file_changes: RejectFileChangesTool,
  } as const;
  
  const ToolClass = toolImplementations[toolName];
  if (!ToolClass) {
    throw new Error(`Unknown tool: ${params.name}`);
  }
  
  return new ToolClass(params, this.options);
}
```

### 2. Update Tool Runners

Each tool runner should be updated to import its types from the new unified definitions:

```typescript
// Replace this import
import { ReadFileToolParams } from "../schema/read_file";

// With this import
import { ReadFileToolParams } from "../definitions";
```

### 3. Integrate System Prompt Generator

Update the agent initialization to use the new system prompt generator:

```typescript
// Import the generator
import { generateToolsSystemPrompt } from "../tools/utils/system-prompt-generator";

// Use it in the system prompt
const systemPrompt = `
${baseSystemPrompt}

${generateToolsSystemPrompt()}

${additionalInstructions}
`;
```

### 4. Update Tool Parser

Enhance the ToolParser to support both the standard and legacy XML formats:

```typescript
// Add support for both formats in the pattern matching
const standardPattern = /<tool name="([^"]+)">([\s\S]*?)<\/tool>/g;
const legacyPattern = /<([^>]+)>([\s\S]*?)<\/\1>/g;

// Check both patterns when parsing
function parseToolUse(text: string) {
  let match;
  
  // Try standard format first
  match = standardPattern.exec(text);
  if (match) {
    const [fullMatch, toolName, paramsText] = match;
    // Process params and return
    return { toolName, params, fullMatch };
  }
  
  // Try legacy format as fallback
  match = legacyPattern.exec(text);
  if (match) {
    const [fullMatch, toolName, paramsText] = match;
    // Process params and return
    return { toolName, params, fullMatch };
  }
  
  return null;
}
```

### 5. Phase Out Old Definitions

Once the new system is in place and tested:

1. Create a deprecation notice in the `/schema` and `/prompts/tools` directories
2. Mark the old imports as deprecated in the codebase
3. Establish a timeline for removing the old files entirely

## Testing Strategy

1. Create unit tests for the new unified definitions
2. Test each tool with both standard and legacy XML formats
3. Perform integration tests with the ToolExecutor
4. Verify the system prompt generation includes all tools correctly
5. Conduct end-to-end tests with the Claude agent using the new formats

## Rollout Plan

1. Implement the changes in a separate branch
2. Review and test thoroughly
3. Merge to development branch and test in the full system
4. Schedule the production deployment
5. Monitor for any issues after deployment
6. After successful rollout, create a cleanup ticket to remove the deprecated code