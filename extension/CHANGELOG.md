# Change Log

All notable changes to the "claude-coder" extension will be documented in this file.

<!-- Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file. -->

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
