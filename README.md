# Welcome to Kodu Coder

<img src="./assets/kodu.png" width="100" align="right" />
Kodu Coder is a coding agent extension tailored for use with Kodu Cloud. We're excited to share our work with the community and invite you to explore the new features and capabilities we've added.

## About Kodu Coder

Kodu Coder is a powerful tool that helps you code faster and more efficiently. It's like having a coding assistant right in your editor! Kodu Coder can help you with a variety of tasks, from writing code to debugging and testing. It's perfect for developers who want to save time and improve their workflow or for beginners who have never coded before.

## Demo
<p align="center">
  <video src="./assets/demo.mp4" width="100%" />
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=kodu-ai.kodu" target="_blank"><strong>Download Extension</strong></a> | <a href="https://discord.gg/Fn97SD34qk" target="_blank"><strong>Join the Discord</strong></a>
</p>

### Key Features
| Reliable | Fast | Integrated |
|--------------|--------------|--------------|
| **Claude's Vision**<br>Paste images in chat to use Claude's vision capabilities and turn mockups into fully functional applications or fix bugs with screenshots | **Real-time Feedback**<br>Inspect diffs of every change Kodu Coder makes right in the editor, and provide feedback until you're satisfied with the result | **CLI Integration**<br>Run CLI commands directly in chat, so you never have to open a terminal yourself |
| **Permission Control**<br>Permission buttons before using a tool sending information to the API | **Usage Tracking**<br>Track total tokens and API usage cost for the entire task loop and individual requests | **API Request Limit**<br>Set a maximum number of API requests allowed for a task before being prompted for permission to proceed |
| **Automated Result Presentation**<br>Automated result presentation with terminal commands (e.g., `open -a "Google Chrome" index.html`) | **Unlimited API Requests**<br>Leveraging Kodu Cloud to allow for a smoother and unrestricted experience | **Optimized Performance**<br>Efficient token caching and prompt optimization on server side to reduce cost and improve speed |
| **Image Optimization**<br>Image optimization to reduce token cost | **Autopilot Mode**<br>Experimental autopilot mode automatically approves read and write requests, tell Kodu what you need | Many more to come... |


## How does it work

Kodu Coder leverages the powerfull Claude LLM model from Anthropic in collaboration with Kodu Cloud, to provide a seamless use of the underlying model. The extension allows you to interact with the model through a chat interface, where you can ask questions, run commands, and get help with your code. Kodu Cloud adds the ability to use *tools* to help you code faster and more efficiently. 

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
9. **Open File**: Open a file in the default application for the file type
10. *More to come...*: Have a suggestion? Let us know by creating an issue or telling us about it in our Discord server!

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
