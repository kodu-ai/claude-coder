# Welcome to Kodu Coder

Kodu Coder is a coding agent extension tailored for use with Kodu Cloud. We're excited to share our work with the community and invite you to explore the new features and capabilities we've added.

## About Kodu Coder

Building on advanced coding capabilities, Kodu Coder takes software development assistance to the next level. It's designed to handle complex tasks step-by-step, offering a unique blend of AI-powered coding support and human oversight.

<p align="center">
  <img src="https://media.githubusercontent.com/media/saoudrizwan/claude-dev/main/demo.gif" width="100%" />
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=kodu-ai.kodu" target="_blank"><strong>Download VSCode Extension</strong></a> | <a href="https://discord.gg/Fn97SD34qk" target="_blank"><strong>Join the Discord</strong></a>
</p>

### Key Features

-   Paste images in chat to use Claude's vision capabilities and turn mockups into fully functional applications or fix bugs with screenshots
-   Inspect diffs of every change Kodu Coder makes right in the editor, and provide feedback until you're satisfied with the result
-   Run CLI commands directly in chat, so you never have to open a terminal yourself (+ respond to interactive commands by sending a message)
-   Permission buttons (i.e., 'Approve terminal command') before tool use or sending information to the API
-   Track total tokens and API usage cost for the entire task loop and individual requests
-   Set a maximum number of API requests allowed for a task before being prompted for permission to proceed
-   Automated result presentation with terminal commands (e.g., `open -a "Google Chrome" index.html`)
-   Unlimited API requests under Kodu Cloud
-   Efficient token caching and prompt optimization on server side to reduce cost and improve speed
-   Image optimization to reduce token cost
-   Experimental autopilot mode (automatically approves read and write requests)

_**Pro tip**: Use the `Cmd + Shift + P` shortcut to open the command palette and type `Kodu Coder: Open In New Tab` to start a new task right in the editor._

## How it works

Kodu Coder uses an autonomous task execution loop with chain-of-thought prompting and access to powerful tools that give it the ability to accomplish nearly any task. Start by providing a task, and the loop fires off, where Kodu Coder might use certain tools (with your permission) to accomplish each step in its thought process.

### Tools

Kodu Coder has access to the following capabilities:

1. **Execute Command**: Run terminal commands on the system (with user permission)
2. **List Files (Top Level)**: List all paths for files at the top level of a specified directory
3. **List Files (Recursive)**: List all paths for files in a specified directory and nested subdirectories
4. **View Source Code Definitions**: Parse source code files to extract names of key elements like classes and functions
5. **Read File**: Read the contents of a file at a specified path
6. **Write to File**: Write content to a file at a specified path, creating necessary directories
7. **Ask Followup Question**: Gather additional information from the user to complete a task
8. **Attempt Completion**: Present the result to the user after completing a task

## Working in Existing Projects

Kodu Coder can efficiently navigate and understand existing projects by:

1. Analyzing the file structure
2. Examining source code definitions
3. Reading relevant files

This approach allows Kodu Coder to provide valuable assistance even for complex, large-scale projects without overwhelming its context window.

## Contribution

We are always listening to the community, adding requested features, and fixing bugs. If you want to contribute your own files, please check our CLA and contribution guide. We gladly accept contributions!

To build Kodu Coder locally, follow these steps:

1. Clone the repository:
    ```bash
    git clone https://github.com/kodu-ai/kodu-coder.git
    ```
2. Open the project in VSCode:
    ```bash
    code kodu-coder
    ```
3. Install the necessary dependencies for the extension and webview-gui:
    ```bash
    npm run install:all
    ```
4. Launch by pressing `F5` to open a new VSCode window with the extension loaded

## License

This project is licensed under the AGPL License. See the [LICENSE](./LICENSE) file for details.

## Questions?

Contact us via [Email](mailto:support@kodu.ai). Please create an [issue](https://github.com/kodu-ai/kodu-coder) if you come across a bug or would like a feature to be added.
