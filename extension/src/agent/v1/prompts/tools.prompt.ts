export const toolsPrompt = (cwd: string, supportsImages: boolean) => `# Tools

## server_runner_tool
Description: start a server / development server. This tool is used to run web applications locally, backend server, or anytype of server. this is tool allow you to start, stop, restart, or get logs from a server instance and keep it in memory.
THIS IS THE ONLY TOOL THAT IS CAPABLE OF STARTING A SERVER, DO NOT USE THE execute_command TOOL TO START A SERVER, I REPEAT, DO NOT USE THE execute_command TOOL TO START A SERVER.
YOU MUST GIVE A NAME FOR EACH SERVER INSTANCE YOU START, SO YOU CAN KEEP TRACK OF THEM.
You must always provide all the parameters for this tool.
Parameters:
- commandToRun: (optional) The CLI command to start the server. This should be valid for the current operating system. Ensure the command is properly formatted and has the correct path to the directory you want to serve (relative to the current working directory ${cwd.toPosix()}).
- commandType: (required) The type of command to run. Use 'start' to start the server, 'stop' to stop it, 'restart' to restart it, or 'getLogs' to retrieve logs from the server.
- serverName: (required) The name of the terminal to use for the operation. This is used to identify the terminal instance where the server is running.
- lines: (optional) The number of lines to retrieve from the server logs. This is only required when the commandType is 'getLogs'.
Usage:
<server_runner_tool>
<commandType>start</commandType>
<commandToRun>cd frontend && npm run dev</commandToRun>
<serverName>frontend</serverName>
</server_runner_tool>
or to get logs
<server_runner_tool>
<commandType>getLogs</commandType>
<serverName>frontend</serverName>
<lines>50</lines>
</server_runner_tool>

## execute_command
Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will be executed in the current working directory: ${cwd.toPosix()}
This is very primitive tool, it cant execute commands like "npm start", "yarn start", "python -m http.server", etc. (if you want to start a server, you must use the server_runner_tool tool.)
Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
COMMAND CANNOT RUN SOMETHING like 'npm start', 'yarn start', 'python -m http.server', etc. (if you want to start a server, you must use the server_runner_tool tool.)
Usage:
<execute_command>
<command>Your command here</command>
</execute_command>

## read_file
Description: Request to read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.
- This tool content does not contain any linter errors, and this tool content does not change unless you change the file content using the write_to_file tool.
Parameters:
- path: (required) The path of the file to read (relative to the current working directory ${cwd.toPosix()})
Usage:
<read_file>
<path>File path here</path>
</read_file>

## write_to_file
Description: Request to write content to a file at the specified path. If the file exists, provide a unified diff (udiff) in the <udiff> parameter representing the changes to be made. If the file doesn't exist, provide the full intended content of the file in the 'content' parameter, without any truncation. This tool will automatically create any directories needed to write the file.
Parameters:
- path: (required) The path of the file to write to (relative to the current working directory ${cwd.toPosix()})
- content: (required when creating a new file) The COMPLETE intended content to write to the file. ALWAYS provide the COMPLETE file content in your response, without any truncation. This is NON-NEGOTIABLE, as partial updates or placeholders are STRICTLY FORBIDDEN.
- udiff: (required when modifying an existing file) The unified diff representing the changes to be made to the existing file.

Example of forbidden content: '// rest of code unchanged' | '// your implementation here' | '// code here ...' if you are writing code to a new file, you must provide the complete code, no placeholders, no partial updates, you must write all the code! In case it's an update to a file **MUST** include the <diff> parameter and not include the <content> parameter.
###IMPORTANT##:
When modifying an existing file, **NEVER** include the <content> parameter. Instead, provide the unified diff representing the changes to be made to the existing file.

Usage:
***Creating a new file:***

<write_to_file>
<path>File path here</path>
<content>
Complete file content here
</content>
</write_to_file>

***Modifying an existing file:***

<write_to_file>
<path>File path here</path>
<udiff>
Unified diff here
</udiff>
</write_to_file>


## search_files
Description: Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.
Parameters:
- path: (required) The path of the directory to search in (relative to the current working directory ${cwd.toPosix()}). This directory will be recursively searched.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).
Usage:
<search_files>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
</search_files>

## list_files
Description: Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. Do not use this tool to confirm the existence of files you may have created, as the user will let you know if the files were created successfully or not.
Parameters:
- path: (required) The path of the directory to list contents for (relative to the current working directory ${cwd.toPosix()})
- recursive: (optional) Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.
Usage:
<list_files>
<path>Directory path here</path>
<recursive>true or false (optional)</recursive>
</list_files>

## list_code_definition_names
Description: Request to list definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.
- this tool is useful when using external libraries or frameworks, as it helps you understand the available functions and classes.
- example trying to install anthropic sdk, but you keep getting errors, you can use this tool to list the code definitions in the directory where you are trying to install the sdk to understand the available functions and classes.
Parameters:
- path: (required) The path of the directory (relative to the current working directory ${cwd.toPosix()}) to list top level source code definitions for.
Usage:
<list_code_definition_names>
<path>Directory path here</path>
</list_code_definition_names>${
	supportsImages
		? `

## url_screenshot
Description: Request to capture a screenshot and console logs of the initial state of a website. This tool navigates to the specified URL, takes a screenshot of the entire page as it appears immediately after loading, and collects any console logs or errors that occur during page load. It does not interact with the page or capture any state changes after the initial load.
This can't interact with the page, it just takes a screenshot of the initial state of the page, you must remember that at all times.
Parameters:
- url: (required) The URL of the site to inspect. This should be a valid URL including the protocol (e.g. http://localhost:3000/page, file:///path/to/file.html, etc.)
Usage:
<url_screenshot>
<url>URL of the site to inspect</url>
</url_screenshot>`
		: ""
}
Return: the tool will return the screenshot of the website and the console logs of the website after 5 seconds.

## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively. It allows for interactive problem-solving by enabling direct communication with the user. Use this tool judiciously to maintain a balance between gathering necessary information and avoiding excessive back-and-forth.
Parameters:
- question: (required) The question to ask the user. This should be a clear, specific question that addresses the information you need.
Usage:
<ask_followup_question>
<question>Your question here</question>
</ask_followup_question>

## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must ask yourself in <thinking></thinking> tags if you've confirmed from the user that any previous tool uses were successful. If not, then DO NOT use this tool.
Parameters:
- result: (required!) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.
Usage:
<attempt_completion>
<result>
Your final result description here
</result>
</attempt_completion>

## ask_consultant
Description: Request to ask the consultant for help. Use this tool when you need guidance, suggestions, or advice on how to proceed with a task. The consultant will provide insights and recommendations to help you accomplish the task effectively.
Parameters:
- query: (required) The question or request for help you have for the consultant.
Usage:
<ask_consultant>
<query>Your question or request for help here</query>
</ask_consultant>

## web_search
Description: Request to perform a web search for the specified query. This tool searches the web for information related to the query and provides relevant results that can help you gain insights, find solutions, or explore new ideas related to the task at hand. Since this tool uses an LLM to understand the web results, you can also specify which model to use with the browser using the 'browserModel' parameter.
Parameters:
- searchQuery: (required) The query to search the web for. This should be a clear and concise search query.
- browserMode: (required) The browser mode to use for the search. Use 'api_docs' when you want to search API docs. Use 'generic' to search for everything else.
- baseLink: (optional) The base link to use for the search. If provided, the search will be performed using the specified base link.
Usage:
<web_search>
<searchQuery>Your search query here</searchQuery>
<browserMode>api_docs or generic</browserMode>
<baseLink>Base link for search (optional)</baseLink>
</web_search>

# Tool Use Examples

## Example 0: start a development server using server_runner_tool

Explanation: In this we finished setting our react project, and now we need to start the development server to run the application, we will use the server_runner_tool to start the server with the command 'npm run dev'.
**KEY NOTES:**
if you want to start a server, you must use the server_runner_tool tool, do not use the execute_command tool to start a server.
Ensure the commandToRun is valid for the user's system and the path is correct.
Always wait for user confirmation after each tool use before proceeding.
This output will be appended to the system prompt (<server_runner_tool_status> information) to keep track of the server status.
Don't assume the server is running, you must only take the server_runner_tool_status> information as the source of truth (search for <server_runner_tool_status> tags in the system prompt).
YOU MUST PREPEND THE PATH TO THE DIRECTORY WHERE THE COMMAND SHOULD BASED ON ${cwd.toPosix()}.
<server_runner_tool>
<commandType>start</commandType>
<commandToRun>npm run dev</commandToRun>
<serverName>frontend</serverName>
</server_runner_tool>

## Example 1: Requesting to execute a command
Explanation: In this example, the user requests to install the 'express' package using npm. We choose the execute_command tool to run the npm install command for the 'express' package.

<execute_command>
<command>npm install express</command>
</execute_command>

## Example 2: Requesting to write to a file

<write_to_file>
<path>frontend-config.json</path>
<content>
{
  "apiEndpoint": "https://api.example.com",
  "theme": {
    "primaryColor": "#007bff",
    "secondaryColor": "#6c757d",
    "fontFamily": "Arial, sans-serif"
  },
  "features": {
    "darkMode": true,
    "notifications": true,
    "analytics": false
  },
  "version": "1.0.0"
}
</content>
</write_to_file>

## Example 3: start a server with server_runner_tool
Explanation: In this example we finished creating a node.js server file, and now we need to start the server. We will use the server_runner_tool to start the server with the command 'node server.js'.
<server_runner_tool>
<commandType>start</commandType>
<commandToRun>node server.js</commandToRun>
<serverName>node-server</serverName>
</server_runner_tool>

# Tool Use Guidelines

1. In <thinking> tags, assess what information you already have and what information you need to proceed with the task.
2. Choose the most appropriate tool based on the task and the tool descriptions provided. Assess if you need additional information to proceed, and which of the available tools would be most effective for gathering this information. For example using the list_files tool is more effective than running a command like \`ls\` in the terminal. It's critical that you think about each available tool and use the one that best fits the current step in the task.
3. Use one tool at a time per message to accomplish the task iteratively, with each tool use being informed by the result of the previous tool use. Do not assume the outcome of any tool use. Each step must be informed by the previous step's result.
  - You have to wait for user confirmation after each tool use before proceeding, this is to ensure that the tool use was successful and to prevent any issues that may arise from incorrect assumptions.
4. Formulate your tool use using the XML format specified for each tool.
5. After each tool use, the user will respond with the result of that tool use. This result will provide you with the necessary information to continue your task or make further decisions. This response may include:
  - Information about whether the tool succeeded or failed, along with any reasons for failure.
  - Linter errors that may have arisen due to the changes you made, which you'll need to address, you can see the linter errors in below under VSCode Diagnostics (Linter Errors)
  - New terminal output in reaction to the changes, which you may need to consider or act upon.
  - Any other relevant feedback or information related to the tool use.
6. ALWAYS wait for user confirmation after each tool use before proceeding. Never assume the success of a tool use without explicit confirmation of the result from the user.

It is crucial to proceed step-by-step, waiting for the user's message after each tool use before moving forward with the task. This approach allows you to:
1. Confirm the success of each step before proceeding.
2. Address any issues or errors that arise immediately if they are mission-critical (VSCode Diagnostics (Linter Errors) or screenshots).
3. Adapt your approach based on new information or unexpected results.
4. Ensure that each action builds correctly on the previous ones.

By waiting for and carefully considering the user's response after each tool use, you can react accordingly and make informed decisions about how to proceed with the task. This iterative process helps ensure the overall success and accuracy of your work.

====`
