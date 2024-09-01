# Welcome to our experimental fork!

This project is an experimental fork of Claude Dev, tailored for use with Kodu Cloud. We're excited to share our work with the community and invite you to explore the new features and capabilities we've added.

### Important Note

While we've built upon the excellent foundation of Claude Dev, please be aware that this version is still in an experimental stage. We recommend using it primarily for testing and exploration with Kodu Cloud.

### Acknowledgments

We want to express our sincere gratitude to Saoud for his incredible work. Their efforts have made this experimental fork possible. If you're looking for a more stable version, we highly recommend checking out the original Claude Dev project.
We hope in the future some of the features will be merged back to the main branch.

## About Claude Dev

Building on [Claude 3.5 Sonnet's advanced coding capabilities](https://www-cdn.anthropic.com/fed9cc193a14b84131812372d8d5857f8f304c52/Model_Card_Claude_3_Addendum.pdf), Claude Dev Experimental takes software development assistance to the next level. It's designed to handle complex tasks step-by-step, offering a unique blend of AI-powered coding support and human oversight.

<p align="center">
  <img src="https://media.githubusercontent.com/media/saoudrizwan/claude-dev/main/demo.gif" width="100%" />
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=kodu-ai.claude-dev-experimental" target="_blank"><strong>Download VSCode Extension</strong></a> | <a href="https://discord.gg/Fn97SD34qk" target="_blank"><strong>Join the Discord</strong></a>
</p>

Thanks to [Claude 3.5 Sonnet's agentic coding capabilities](https://www-cdn.anthropic.com/fed9cc193a14b84131812372d8d5857f8f304c52/Model_Card_Claude_3_Addendum.pdf) Claude Dev can handle complex software development tasks step-by-step. With tools that let him create & edit files, explore complex projects, and execute terminal commands (after you grant permission), he can assist you in ways that go beyond simple code completion or tech support. While autonomous AI scripts traditionally run in sandboxed environments, Claude Dev provides a human-in-the-loop GUI to supervise every file changed and command executed, providing a safe and accessible way to explore the potential of agentic AI.

-   Paste images in chat to use Claude's vision capabilities and turn mockups into fully functional applications or fix bugs with screenshots
-   Inspect diffs of every change Claude makes right in the editor, and provide feedback until you're satisfied with the result
-   Runs CLI commands directly in chat, so you never have to open a terminal yourself (+ respond to interactive commands by sending a message)
-   Presents permission buttons (i.e. 'Approve terminal command') before tool use or sending information to the API
-   Keep track of total tokens and API usage cost for the entire task loop and individual requests
-   Set a maximum # of API requests allowed for a task before being prompted for permission to proceed
-   When a task is completed, Claude determines if he can present the result to you with a terminal command like `open -a "Google Chrome" index.html`, which you run with a click of a button

_**Pro tip**: Use the `Cmd + Shift + P` shortcut to open the command palette and type `Claude Dev: Open In New Tab` to start a new task right in the editor._

## How it works

Claude Dev uses an autonomous task execution loop with chain-of-thought prompting and access to powerful tools that give him the ability to accomplish nearly any task. Start by providing a task and the loop fires off, where Claude might use certain tools (with your permission) to accomplish each step in his thought process.

### Tools

Claude Dev has access to the following capabilities:

1. **`execute_command`**: Execute terminal commands on the system (only with your permission, output is streamed into the chat and you can respond to stdin or exit long-running processes when you're ready)
2. **`list_files_top_level`**: List all paths for files at the top level of the specified directory (useful for generic file operations like retrieving a file from your Desktop)
3. **`list_files_recursive`**: List all paths for files in the specified directory and nested subdirectories (excludes files in .gitignore)
4. **`view_source_code_definitions_top_level`**: Parses all source code files at the top level of the specified directory to extract names of key elements like classes and functions (see more below)
5. **`read_file`**: Read the contents of a file at the specified path
6. **`write_to_file`**: Write content to a file at the specified path, automatically creating any necessary directories
7. **`ask_followup_question`**: Ask the user a question to gather additional information needed to complete a task (due to the autonomous nature of the program, this isn't a typical chatbot–Claude Dev must explicitly interrupt his task loop to ask for more information)
8. **`attempt_completion`**: Present the result to the user after completing a task, potentially with a terminal command to kickoff a demonstration

### Working in Existing Projects

When given a task in an existing project, Claude will look for the most relevant files to read and edit the same way you or I would–by first looking at the names of directories, files, classes, and functions since these names tend to reflect their purpose and role within the broader system, and often encapsulate high-level concepts and relationships that help understand a project's overall architecture. With tools like `list_files_recursive` and `view_source_code_definitions_top_level`, Claude is able to extract names of various elements in a project to determine what files are most relevant to a given task without you having to mention `@file`s or `@folder`s yourself.

1. **File Structure**: Claude first uses the `list_files_recursive` tool to get a complete picture of the project's file structure. It turns out Claude 3.5 Sonnet is _really_ good at inferring what it needs to process further just from these file names alone.

2. **Source Code Definitions**: Claude may then use the `view_source_code_definitions_top_level` tool on specific directories of interest. This tool uses [tree-sitter](https://github.com/tree-sitter/tree-sitter) to parse source code with custom tag queries that extract names of classes, functions, methods, and other definitions. It works by first identifying source code files that tree-sitter can parse (currently supports `python`, `javascript`, `typescript`, `ruby`, `go`, `java`, `php`, `rust`, `c`, `c++`, `c#`, `swift`), then parsing each file into an abstract syntax tree, and finally applying a language-specific query to extract definition names (you can see the exact query used for each language in `src/parse-source-code/queries`). The results are formatted into a concise & readable output that Claude can easily interpret to quickly understand the code's structure and purpose.

3. **Read Relevant Files**: With insights gained from the names of various files and source code definitions, Claude can then use the `read_file` tool to examine specific files that are most relevant to the task at hand.

By carefully managing what information is added to context, Claude can provide valuable assistance even for complex, large-scale projects without overwhelming its context window.

### Only With Your Permission

Claude always asks for your permission first before any tools are executed or information is sent back to the API. This puts you in control of this agentic loop, every step of the way.

![image](https://github.com/saoudrizwan/claude-dev/assets/7799382/e6435441-9400-41c9-98a9-63f75c5d45be)

## Contribution

Paul Graham said it best, "if you build something now that barely works with AI, the next models will make it _really_ work." I've built this project with the assumption that scaling laws will continue to improve the quality (and cost) of AI models, and what might be difficult for Claude 3.5 Sonnet today will be effortless for future generations. That is the design philosophy I'd like to develop this project with, so it will always be updated with the best models, tools, and capabilities available–without wasting effort on implementing stopgaps like cheaper agents. With that said, I'm always open to suggestions and feedback, so please feel free to contribute to this project by submitting issues and pull requests.

To build Claude Dev locally, follow these steps:

1. Clone the repository:
    ```bash
    git clone https://github.com/kodu-ai/claude-dev-experimental.git
    ```
2. Open the project in VSCode:
    ```bash
    code claude-dev-experimental
    ```
3. Install the necessary dependencies for the extension and webview-gui:
    ```bash
    npm run install:all
    ```
4. Launch by pressing `F5` to open a new VSCode window with the extension loaded

## Reviews

-   ["Claude Sonnet 3.5 Artifacts in VSCode With This Extension"](https://www.youtube.com/watch?v=5FbZ8ALfSTs) by [CoderOne](https://www.youtube.com/@CoderOne)
-   ["ClaudeDev: NEW Coding Agent Can Generate Applications within VS Code!"](https://www.youtube.com/watch?v=UNsQHosbIoE) by [WorldofAI](https://www.youtube.com/@intheworldofai)
-   ["ClaudeDev: This Mind-Blowing Coding Agent Can Build SaaS Apps in Minutes!"](https://www.youtube.com/watch?v=Ki0nuOeUpT0) by [AI for Devs](https://www.youtube.com/@ai-for-devs)
-   ["Claude Dev: This Coding Agent can Generate Applications Within VS Code!"](https://www.youtube.com/watch?v=ufq6sHGe0zs) by [AICodeKing](https://www.youtube.com/@AICodeKing)
-   ["ClaudeDev + NextJS + Supabase: Generate FULL-STACK Apps with Claude 3.5 Sonnet"](https://www.youtube.com/watch?v=GeZBfO1kxA4) by [AICodeKing](https://www.youtube.com/@AICodeKing)
-   ["Meet Claude Dev — An Open-Source AI Programmer In VS Code"](https://generativeai.pub/meet-claude-dev-an-open-source-autonomous-ai-programmer-in-vs-code-f457f9821b7b) and ["Build games with zero code using Claude Dev in VS Code"](https://www.youtube.com/watch?v=VT-JYVi81ew) by [Jim Clyde Monge](https://jimclydemonge.medium.com/)
-   ["Claude Dev Builds NextJS App! Aider, Continue Dev & GitHub Copilot Open-Source Alternative"](https://www.youtube.com/watch?v=Rv0wJZRpnCQ) by [Josh Pocock](https://www.youtube.com/@joshfpocock)
-   ["Claude Dev Is Mindblowing. The Best Coding Assistant tool?"](https://www.youtube.com/watch?v=Vp1Z3VGZroA), ["Combining Claude Dev With Google Gemini To Build Fast With Low Effort"](https://www.youtube.com/watch?v=cAfunEHLees), and ["Browser Automation Made Easy With Claude Dev"](https://www.youtube.com/watch?v=EQ4O8rUOqZs) by [Yaron Been](https://www.youtube.com/@ecomxfactor-YaronBeen)
-   ["ClaudeDev: The Ultimate Coding Agent for VS Code"](https://www.youtube.com/watch?v=aq0yw_DtphQ) by [Blas](https://www.youtube.com/@blascerecer)
-   ["I Built My First Web App in One Day Using Claude Dev Extension – Mind Blown!"](https://www.reddit.com/r/ClaudeAI/comments/1eqo3nk/i_built_my_first_web_app_in_one_day_using_claude/)
-   ["AI Development with Claude Dev"](https://www.linkedin.com/pulse/ai-development-claude-dev-shannon-lal-3ql3e/) by Shannon Lal
-   ["Code Smarter with Claude Dev: An AI Programmer for Your Projects"](https://www.linkedin.com/pulse/code-smarter-claude-dev-ai-programmer-your-projects-iana-detochka-jiqpe) by Iana D.
-   [Claude Dev also hit top 10 posts of all time on r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/comments/1e3h0f1/my_submission_to_anthropics_build_with_claude/)

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Questions?

Contact us on <a href="mailto:support@kodu.ai">Email</a>. Please create an <a href="https://github.com/kodu-ai/claude-dev-experimental/issues">issue</a> if you come across a bug or would like a feature to be added.
