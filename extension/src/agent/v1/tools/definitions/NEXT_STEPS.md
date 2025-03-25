# Next Steps for Tool Definition Unification

## Completed Work

1. ✅ Created a unified tool call template with consistent XML format
2. ✅ Implemented 19 tool definitions using the new unified format:
   - read_file
   - search_files
   - execute_command
   - list_files
   - file_editor
   - ask_followup_question
   - search_symbol
   - url_screenshot
   - attempt_completion
   - explore_repo_folder
   - spawn_agent
   - exit_agent
   - server_runner
   - web_search
   - write_to_file
   - add_interested_file
   - file_changes_plan
   - submit_review
   - reject_file_changes
3. ✅ Created helper functions to manage tool definitions
4. ✅ Developed system prompt generator for consistent LLM instructions
5. ✅ Documented the new architecture and migration strategy

## Pending Tasks

1. 🔲 Update the ToolExecutor to use unified definitions
   - Modify imports to use new definitions
   - Update ToolParser initialization
   - Make createTool method more dynamic

2. 🔲 Update tool runners to reference unified definitions
   - Replace schema imports with definition imports
   - Ensure type compatibility

3. 🔲 Integrate the system prompt generator
   - Connect to agent initialization
   - Test generation with all tools

4. 🔲 Enhance the ToolParser
   - Add support for both standard and legacy XML formats
   - Ensure parameter extraction works with new format

5. 🔲 Testing
   - Create unit tests for the unified definitions
   - Test LLM understanding of the new format
   - End-to-end testing with all tools

6. 🔲 Documentation
   - Update developer documentation to reflect the new architecture
   - Add examples of how to create new tool definitions

## Benefits of the New Architecture

1. **Single Source of Truth**: All information about a tool is in one place
2. **Type Safety**: TypeScript types are derived directly from Zod schemas
3. **Consistent Calling Format**: All tools use the same XML format
4. **Better LLM Understanding**: Standardized examples improve Claude's tool usage
5. **Easier Maintenance**: Adding or modifying tools requires changes in fewer places
6. **Automated Documentation**: System prompts can be generated from definitions
7. **Future Compatibility**: The format supports both current and future Claude models

## Implementation Priority

1. Start with the ToolExecutor updates, as this is the central integration point
2. Update the most commonly used tool runners first
3. Integrate the system prompt generator to improve LLM understanding
4. Add testing throughout the process
5. Continue with less frequently used tools
6. Complete documentation updates last

## Timeline Estimate

- **Week 1**: Implement ToolExecutor changes and update common runners
- **Week 2**: Update remaining runners and integrate system prompt generator
- **Week 3**: Testing, bug fixing, and documentation
- **Week 4**: Phase out old definitions and monitor for issues