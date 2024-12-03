# Change Log

All notable changes to the "claude-coder" extension will be documented in this file.

<!-- Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file. -->

## [1.14.1] - 2024-12-03

### New

-   Inline edits automatically fix LLM bad tab generation
-   Inline edits automatically format the file post edit block

## [1.14.0] - 2024-12-03

### Changed

-   New Inline edit viewer using the default git format
-   Better support for broken edits and higher accuracy at applying the edit.

## [1.13.12] - 2024-11-29

### Fixed

-   autosummary should now out perform the default algorithm for context management
-   better inline edits for windows os

## [1.13.8] - 2024-11-28

### Fixed

-   Fixed inline edit edge cases and improved fluency across devices with different latency
-   Fixed whole file write editor edge cases and improved fluency across devices with different latency

## [1.13.7] - 2024-11-27

### Added

-   Added an option to configure the timeout for command execution

### Fixed

-   Feedback on tool is now working as expected (before was broken on command execution with automatic mode)
-   Fix inline edit selector to work as expected

## [1.13.6] - 2024-11-27

### Changed

-   Added option to select inline edit output (full,diff,none)

## [1.13.5] - 2024-11-27

### Changed

-   Reworked autosummary algorithim resulting in upwards of 80% context saving on first compression
-   Improved coverage across extension
-   Fixed extension build and debugging

## [1.13.3] - 2024-11-26

### Changed

-   Improved accuracy of inline edits by outputting the entire file content as the edit result.

## [1.13.2] - 2024-11-26

### FIXED

-   Fixed inline edit tab focus, now it correctly focus on the tab on open and before save.

## [1.13.1] - 2024-11-26

### Added

-   Pause and Resume automatic mode mid task
-   Terminal output compression with settings to configure the tokens

### Changed

-   Fixed inline edit animation behavior to work across all instances (closed tab / open tab)

## [1.13.0] - 2024-11-25

### Added

-   New high-performance animation system for inline edits
-   Support for concurrent multiple edits within a single tool request

### Changed

-   Significantly improved overall extension performance and resource utilization
-   Enhanced code generation accuracy for inline edits
-   Stabilized inline editing system for better reliability

## [1.11.4] - 2024-11-18

-   Added way for vscodium users to login

## [1.11.3] - 2024-11-18

-   Added option to login using API KEY via command (CTRL + P > Set Api Key)
-   Added option to pause next request on automatic mode

## [1.11.2] - 2024-11-18

-   Fix write to file encoding for python files

## [1.11.1] - 2024-11-15

-   Fix opening Kodu on a new tab

## [1.11.0] - 2024-11-14

-   New Diff View Algorithm
    -   Improved CPU usage
    -   Eliminated edge cases causing diff view crashes during requests
-   Experimental Continuous Generation
    -   Models can now run beyond the max context window
    -   Particularly useful for large files
    -   Chains follow-up requests to continue generation (additional cost applies)

## [1.10.0] - 2024-11-07

### Added

-   New chat compression algorithm for new chats
    -   Improved memory efficiency
    -   Better context preservation
-   Enhanced streaming UI implementation

### Fixed

-   Edge case stream corruption issues
-   Image format handling
-   Chat truncation prevention mechanisms

### Changed

-   Improved overall extension performance
    -   Reduced memory footprint
    -   Faster response times
    -   Better resource utilization

## [1.9.26] - 2024-11-05

### Added

-   Smart chat compression for improved memory management
    -   Automatically compresses chat history while preserving context
    -   Configurable compression settings
-   Claude 3.5 Haiku model support to the available models list
-   Code truncation detection in write_to_file tool
    -   Auto-detection of AI code omissions
    -   Automatic follow-up requests for complete implementations

### Fixed

-   Frontend stream synchronization with fast-streaming responses
    -   Resolved performance bottlenecks in real-time message display
    -   Improved buffer handling for high-speed responses
-   Error handling for corrupted task objects
    -   Added graceful error recovery
    -   Improved error logging and diagnostics

### Changed

-   Memory management system now uses compression by default
-   Stream handling architecture for better performance

### Security

-   Added validation for task objects to prevent corruption-based exploits

## [1.9.22]

-   [FIX]: @debug was triggering wrong internal command.

## [1.9.21]

-   [FIX]: @debug command now working properly

## [1.9.20]

-   [NEW]: Web search tool settings, allowing you to control which model the tool uses.
-   [NEW]: Updated search categories in the Web Search tool for better search results.
-   [NEW]: Improved performance for Diff view.
-   [NEW]: Ability to select system prompts (will gradually expand on this feature).
-   [NEW]: Context window manager to view the current task's context memory.
-   [NEW]: Server runner tool now maintains the presence of recent logs and all logs.
-   [FIX]: Stabilized rendering and removed race conditions in the code.
-   [FIX]: Improved streaming functionality to work properly with one tool at a time.
-   [FIX]: Enhanced diagnostics for better feedback when editing files.
-   [FIX]: Execute command and server runner now work correctly.
-   [FIX]: More graceful error handling to prevent program crashes or corrupted tasks.
-   [ADJUSTMENT]: System prompt now better obeys user requests and truncates code less often.

## [1.9.19]

-   [FIX]: prompt caching, reduce cost.
-   [ADJUSTMENT]: better attention on system prompt to prevent looping and get task done faster.
-   [FIX]: server runner tool was having trouble sometimes do to missing cleanup.

## [1.9.18]

-   [FIX]: adjust system prompt to prevent redundant reads
-   [FIX]: add more attention to // ... (previous code remains unchanged)
-   [NEW]: detailed chain of thought for tool call and steps

## [1.9.17]

-   [NEW]: Improved prompt caching, significantly reducing costs.
-   [NEW]: Added settings tab for more customization options.
-   [NEW]: Auto-close terminal after execution (toggleable).
-   [NEW]: Option to disable write file animation.
-   [NEW]: Server runner tool for efficiently managing development servers, providing better insights for Kodu.
-   [NEW]: Chain-of-thought prompting to prevent getting stuck in loops.
-   [FIX]: Resolved write-to-file corruption in certain edge cases.
-   [FIX]: Improved terminal behavior for better accuracy.
-   [FIX]: Stabilized automatic mode for increased effectiveness.
-   [REMOVE]: Removed trial offer.
-   [ADJUSTMENT]: Relaxed linting checks to prevent Kodu from getting stuck on non-critical errors.

## [1.9.16]

-   [FIX]: prompt caching is working more effective now
-   [FIX]: execute commands now run properly
-   [NEW]: execute commands can now be ran easily on the background
-   [NEW]: automatically close terminal after command finish executing
-   [NEW]: improved loop detection and diagonstic tools

## [1.9.9]

-   [FIX]: tools and chat scroll

## [1.9.6]

-   [FIX]: prompt caching
-   [FIX]: attempt_completion tool when command is included.

## [1.9.3]

-   Streaming UI Beta
-   Revert 1.9.0 for now

## [1.9.0]

-   Improved Attachments: removed the need for approval to read attachments.
-   Improved Design: redesigned the chat interface to better suit non-technical users.
-   Added Task Memory: built-in memory to improve performance on long-term tasks, keeping our AI on track.
-   Version Control: built-in version control to view your task timeline and jump to specific versions.
-   Improved Internal System Prompt: non-technical prompts should now work much better, with improved thinking and communication processes.
-   New Chat Elements: Call to Action, Thinking, Preview!
-   Removed udiff: current models are not strong enough to use udiff consistently.
-   Added Technical Settings: set your technical level to personalize your experience to better fit your needs.

## [1.8.0]

-   minor updates to readme file
-   fix message format on edge case corruption
-   fix new ui format on loading messages

## [1.7.5]

-   Revert .env file

## [1.7.4]

-   Now we are streaming the response as we get it, making the user experience much better.
-   Allowing to cancel request in the middle with abort button (api charge is still hapenning.)
-   Screenshot tool allowing claude to take screenshot of website and see it's logs
-   Consultant Tool allowing you to talk with smarter models when needed
-   Improve system prompt for UDIFF format

## [1.7.3]

-   mid merge v1.8.0 https://github.com/kodu-ai/claude-coder/pull/11

## [1.7.1-beta]

-   Add quick project starter
-   Add @ command in text area to reference files and sites to scrape
-   Improved automatic mode and bug fixing
-   New Terminal shell integration
-   Autofix Message format on corruption
-   Refactor Context Window (improved context window algorithm, caveat currently there is not public tokenizer for Claude 3+)
-   Improved Task search and task saving (allow you to name tasks and search using fuzzy search)
-   .kodu - allow you to create custom config without breaking the system cache and having higher weight.

## [1.7.0-beta]

-   Add web search tool let's claude coder to search the web with a crawling agent!

## [1.5.6]

-   You can now edit Claude's changes before accepting! When he edits or creates a file, you can modify his changes directly in the right side of the diff view (+ hover over the 'Revert Block' arrow button in the center to undo `// rest of code here` shenanigans)

## [1.5.4]

-   Adds support for reading .pdf and .docx files (try "turn my business_plan.docx into a company website")

## [1.5.0]

-   Adds new `search_files` tool that lets Claude perform regex searches in your project, making it easy for him to refactor code, address TODOs and FIXMEs, remove dead code, and more!

## [1.4.0]

-   Adds "Always allow read-only operations" setting to let Claude read files and view directories without needing approval (off by default)
-   Implement sliding window context management to keep tasks going past 200k tokens
-   Adds Google Cloud Vertex AI support and updates Claude 3.5 Sonnet max output to 8192 tokens for all providers.
-   Improves system prompt to gaurd against lazy edits (less "//rest of code here")

## [1.3.0]

-   Adds task history

## [1.2.0]

-   Adds support for Prompt Caching to significantly reduce costs and response times (currently only available through Anthropic API for Claude 3.5 Sonnet and Claude 3.0 Haiku)

## [1.1.1]

-   Adds option to choose other Claude models (+ GPT-4o, DeepSeek, and Mistral if you use OpenRouter)
-   Adds option to add custom instructions to the end of the system prompt

## [1.1.0]

-   Paste images in chat to use Claude's vision capabilities and turn mockups into fully functional applications or fix bugs with screenshots

## [1.0.9]

-   Add support for OpenRouter and AWS Bedrock

## [1.0.8]

-   Shows diff view of new or edited files right in the editor

## [1.0.7]

-   Replace `list_files` and `analyze_project` with more explicit `list_files_top_level`, `list_files_recursive`, and `view_source_code_definitions_top_level` to get source code definitions only for files relevant to the task

## [1.0.6]

-   Interact with CLI commands by sending messages to stdin and terminating long-running processes like servers
-   Export tasks to markdown files (useful as context for future tasks)

## [1.0.5]

-   Claude now has context about vscode's visible editors and opened tabs

## [1.0.4]

-   Open in the editor (using menu bar or `Claude Dev: Open In New Tab` in command palette) to see how Claude updates your workspace more clearly
-   New `analyze_project` tool to help Claude get a comprehensive overview of your project's source code definitions and file structure
-   Provide feedback to tool use like terminal commands and file edits
-   Updated max output tokens to 8192 so less lazy coding (`// rest of code here...`)
-   Added ability to retry failed API requests (helpful for rate limits)
-   Quality of life improvements like markdown rendering, memory optimizations, better theme support

## [0.0.6]

-   Initial release
