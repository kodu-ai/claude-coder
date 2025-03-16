# Change Log

All notable changes to the "claude-coder" extension will be documented in this file.

<!-- Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file. -->

## [2.3.10] - 2025-03-16

### Fixed

-   VScode terminal race condition
-   API not getting the latest settings
-   UI Optimization to reduce memory footprint

## [2.3.9] - 2025-02-27

### Added

-   Openrouter native support

### Fixed

-   Bug fixes across board (task abort, incorrect context handling)

## [2.3.0] - 2025-02-24

### Added

-   Added Claude 3.7 Sonnet - New SOTA coding agent highly recommended as daily driver
-   Added option to customize Sonnet thinking tokens budget

### Fixed

-   Bug fixes across board

## [2.2.10] - 2025-02-20

### Added

-   Direct link to anthropic api

### Changed

-   UI Theme (better support light and dark mode)

### Fixed

-   Terminal commands with long output may take forever to process or crash
-   Incorrect rendering of codeblocks in the UI
-   Mark as completed

## [2.2.9] - 2025-02-10

### Changed

-   adjust file editor system prompt to write better inline edits
-   adjust file editor inline editor algorithm and testing
-   adjust task history search algorithm

## [2.2.8] - 2025-02-06

### Added

-   Added latest Gemini models (Flash 2, Pro 2)

### Fixed

-   Improved focus retention on file edits
-   Improved error logging and error messages on UI
-   Bug fixed prompt editor onload
-   Bug fixed diagnostic handler with deleted files

## [2.2.7] - 2025-02-01

### Added

-   Quick link to open files (edit / read)
-   o3-mini (high and med) reasoning effort models

## [2.2.6] - 2025-01-26

### Fixed

-   Add file editor kodu content to chat compression (help small context window models)

## [2.2.5] - 2025-01-25

### New

-   Visual indicator for diagnostic handler
-   Better indicators for which model requires api key and how Kodu credit works

### Fixed

-   File rollback using the file editor tool is working as expected
-   Inline editor properly closes if any of the edits fail
-   Prevent switching tabs on diagnostic loading

## [2.2.4] - 2025-01-25

### Fixed

-   fix chat compression on sonnet
-   Posting webview messages would often be skipped on tool call

## [2.2.3] - 2025-01-25

### New

-   Export task files (useful for debugging and loading on new computer)
-   Add option to do one liner search and replace with file editor tool (useful for weak models)

### Fixed

-   Chat compression
-   Posting webview messages would often be skipped on tool call (still investigating)

## [2.2.2] - 2025-01-24

### Fixed

-   Fix critical file indentation bug

## [2.2.1] - 2025-01-24

### Removed

-   Removed page pagination from read file

## [2.2.0] - 2025-01-23

### New

-   Customizable Observer Agent (Custom model selection, observed messages, prompt customization)
-   Full model support for Deepseek R1, Deepseek Chat (v3) and Mistral Codestral
-   Multi-agent system improvements with better coordination

### Improved

-   UI for quick model switching and provider selection
-   System prompt engineering for better instruction following
-   Inline edit accuracy and conflict resolution
-   Error handling with clearer user-facing messages

### Fixed

-   Fixed incorrect command execution result handling
-   Improved diagnostic handler performance on slower computers
-   Fixed context memory loading inconsistencies
-   Fixed edge cases in automatic commit tracking

## [2.1.0] - 2025-01-15

### New

-   Custom models and direct LLM calls (Google AI Studio, Deepseek, OpenAI, LM Studio)
-   Manually Mark task as completed and visual indicator if a task is completed or pending
-   Faster stream, the ui stream should be near instant as we receive content from LLM
-   Switch models mid task without interruption

### Fixed

-   missing feedback message at some tools (file editor -> rollback)
-   diagnostic at times would not load correctly causing LLM to hallucinate
-   edge case bugs
-   less hallucination when editing files (remembering the latest fresh content)

## [2.0.5] - 2025-01-07

### Fixed

-   diagnostic handler will not receive updates correctly if the tab is closed
-   marking a task as complete wouldn't let you send messages afterwards unless you reopen it
-   notify Kodu on how to delete, copy and moved files (using execute_command tool)
-   attempt to enforce Kodu to always pick up the latest file content based on the timestamp and file version.

## [2.0.4] - 2025-01-06

### Fixed

-   missing ui for ask follow up question
-   race condition in task creation (will cause task to corrupt)

### Changed

-   When kodu thinks the task is marked as complete you will be prompted to verify it or provide feedback.
-   Update the initial repo filemap that's provided to Kodu.

## [2.0.3] - 2025-01-05

### Fixed

-   race condition in file writes causing task to corrupt on panic exit
-   ask follow up question would sometimes not work on automatic mode
-   file edit would not take into account auto formatting
-   request failed would not show the fail reason
-   missing UI for autosummary algorithm
-   file editor would at times truncate content or output improper edit
-   other race conditions and edge cases
-   force correct tool calling and only one tool per request (using stop sequence)
-   fixed system prompt to better understand how to observe, think and call an action while maintaing the tool use guidelines

### Removed

-   removed add_interested_files tool

## [2.0.2] - 2024-12-29

### RESYNC

-   resynced v2.0.1 to upstream

## [2.0.1] - 2024-12-29

### New

-   Track task time elapsed
-   Collapse messages

### Changed

-   Prepared for general release 3rd party providers (openrouter, lmstudio)
-   Prepared for general release Agent model selection (allow you to select specifc model for each agent)
-   Update prompt structure and inital task message to allow better discovery of the repo
-   Improved diff editing significantly
-   Improved stream speed and stability
-   Reduce context window consumption

### Fixed

-   Incorrect model display
-   bug fixed numerous edge cases

## [2.0.0] - 2024-12-16

### Changed

-   Better obedience to prompt
-   rewrite tools output to better guide Kodu
-   rewrite system prompt to use ReAct prompting

### New

-   search symbol tool lets Kodu find where a symbol is called in the project
-   read file tool now default to read page by page instead of the entire file at once and output lines correctly
-   file editor tool with option to read file version, file change summary, rollback to file version
-   search repo tool lets Kodu search repo folder for symbols and high level definitions in an entire folder and maps it to easy to digest output
-   better diagnostic now show Kodu the hover hints, related intelligence and the actual line that the error has occurred on.
-   interested files tool lets Kodu note interested files for further usage and remembers it in memory at all time
-   3rd party observer LLM that auto correct Kodu when Kodu makes mistakes and guide Kodu to the path passively
-   reduced token usage
-   improved extension speed
-   Prompt Editor allow you to truly configure your Kodu instructions.
-   auto fix inline edits in the same request
-   multi agent system preview

## [1.16.0] - 2024-12-05

### Changed

-   Tool response adjusted to xml to better match the current structure this increases Kodu understanding and accuracy
-   Linter error response format - now we format the error with clear guidelines and indicators to where the error have occurred giving Kodu easier time resolving bugs
-   Reduced Environment details, this reduces the total amount of tokens used by Kodu by a solid 10-20% on large projects and long tasks.
-   New Adjusted system prompt with less noise and more focus on the task inhand this helps Kodu stay on track and reason his way more correctly.

### Fixed

-   Inline editing would cache incorrect editing position causing edits to be displayed incorrectly

## [1.15.1] - 2024-12-04

### Changed

-   Git Handler can now be toggled on and off in the settings

### Fixed

-   Command execution Tool now properly gets the output
-   Auto chat scrolling to only occur on first render of a task or if the user is in the bottom of the chat

## [1.15.0] - 2024-12-04

### New

-   File history control
    -   Automatic checkpoint creation at file edits, Kodu now remembers old files and let you easily view previous version or do a full rollback.
    -   You can now view old files from the history as long as you're on the related project workspace.
    -   You can now rollback conversation to one of your task checkpoints, reverting the chat history and file changes.
-   Automatic Git commit handling, Kodu will automatically commit any changes made making it easy to identify changes and remove if needed
-   Automatic commit awareness, Kodu is now aware of each commit it made

### Fixed

-   Improved error handling for inline edits.

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
