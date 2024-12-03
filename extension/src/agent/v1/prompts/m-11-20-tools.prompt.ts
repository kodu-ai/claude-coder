import { writeToFileTool } from "../tools/schema"

export const toolsPrompt = (cwd: string, supportsImages: boolean, id?: string) => `# Tools

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

Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish steps in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. The tool provides extensive control over command execution, including timeouts, output limitations and interactive command exeuction. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will be executed in the current working directory: ${cwd.toPosix()}

IMPORTANT: This is a primitive tool designed for command execution and interactive command exeuction. It cannot execute long-running server commands or interactive processes like 'npm start', 'yarn start', 'python -m http.server', etc. For server operations, you must use the server_runner_tool instead.

Parameters:
- id: (optional) A unique identifier for the command execution. It's mandatory to provide id when you try to resume or terminate a long-running command later (type: resume_blocking_command or terminate_blocking_command).
- type: (required) The execution mode for the command. Must be one of:
  - execute_blocking_command: Standard execution that blocks until completion, does not require id.
  - terminate_blocking_command: Stops a running command using its ID, requires id.
  - resume_blocking_command: Continues a previously paused command using its ID, requires id and allows for interactive input using stdin (optional) see examples below.
- command: (required for execute_blocking_command) The CLI command to execute. This must be valid for the current operating system and properly formatted without harmful instructions.
- stdin: (optional, only for resume_blocking_command) Standard input to provide when resuming a paused command that requires input, it requires adding \\n to continue the stdin else where we will consider this as the end of the stdin and it might cause EOF errors if the file has more input, stdin can be used multiple times if the command requires multiple inputs or has multiple pauses, it's extremely powerful for interactive commands.
- timeout: (optional) Maximum execution time in milliseconds before the command is forcefully terminated.
- softTimeout: (optional) Grace period in milliseconds before hard termination, allowing the command to clean up.
- outputMaxLines: (optional, default: 1,000) Maximum number of lines to return in the command output.
- outputMaxTokens: (optional, default: 10,000) Maximum number of tokens to return in the command output.

Command Response Structure:
Every command execution returns a structured response containing:
- output: The command's stdout/stderr output
- completed: Whether the command finished execution
- id: Unique identifier for the command execution mandatory when calling <execute_command> with type: resume_blocking_command or terminate_blocking_command
- exitCode: The command's exit status code
- returnReason: Why the command returned (completed, timeout, maxOutput)
- hint: Human-readable guidance based on the execution result, including:
  - Non-zero exit code warnings
  - Empty output notifications
  - Timeout notifications
  - Maximum output limit notifications
  - Completion confirmations

Usage Examples:

1. Basic Command Execution:
\`\`\`xml
<execute_command>
<type>execute_blocking_command</type>
<command>ls -la</command>
</execute_command>
\`\`\`
Response example:
\`\`\`xml
<output>total 32
drwxr-xr-x  5 user  group  160 Dec  2 10:00 .
drwxr-xr-x  3 user  group   96 Dec  2 10:00 ..</output>
<completed>true</completed>
<id>cmd-12345</id>
<exitCode>0</exitCode>
<returnReason>completed</returnReason>
<hint>The command has completed successfully.</hint>
\`\`\`

2. Resume Command for Additional Output:
When a command hits the output limit, use resume to get remaining output, note command field is not needed for resume but id is mandatory.
First we run a command:
\`\`\`xml
<execute_command>
<type>execute_blocking_command</type>
<command>ls -la</command>
<outputMaxLines>1000</outputMaxLines>
</execute_command>
\`\`\`
Then we get a Response indicating output limit reached:
\`\`\`xml
<output>[First 1000 lines of output]</output>
<completed>false</completed>
<id>cmd-67890</id>
<exitCode>null</exitCode>
<returnReason>maxOutput</returnReason>
<hint>The command has outputted more than the maximum allowed output to get the full output please use the resume_blocking_command tool with the id cmd-67890.</hint>
\`\`\`

Then we can call resume to get more output using the id from the command response:
\`\`\`xml
<execute_command>
<type>resume_blocking_command</type>
<id>cmd-67890</id>
</execute_command>
\`\`\`

3. Resume Command with Input super powerful for interactive commands:
When a command needs additional input or is interactive, you can use resume with stdin to provide the required input.
Here we call resume with stdin to provide input 'y' to command with id cmd-54321:
\`\`\`xml
<execute_command>
<type>resume_blocking_command</type>
<id>cmd-54321</id>
<stdin>y</stdin> ---> we didn't include \\n here so this is the end of the stdin
</execute_command>
\`\`\`

here we call resume and we don't call EOF so we can continue the stdin in the next resume:
\`\`\`xml
<execute_command>
<type>resume_blocking_command</type>
<id>cmd-54321</id>
<stdin>y\n</stdin> ---> we included \\n here so we can continue the stdin in the next resume and the command won't consider this as the end of the stdin
</execute_command>

4. Terminating a Running Command:
If a command is taking too long or needs to be stopped, you can terminate it using the command id.
\`\`\`xml
<execute_command>
<type>terminate_blocking_command</type>
<id>cmd-12345</id>
</execute_command>
\`\`\`

Common Return Reasons:
- completed: Command finished execution normally
- timeout: Command exceeded specified timeout duration
- maxOutput: Command reached output line or token limit
- terminated: Command was manually terminated by the user
  
When to Use Resume:
1. Output Continuation:
   - When a command hits outputMaxLines or outputMaxTokens limits
   - Use resume without stdin to fetch the next chunk of output
   - Repeat until all output is received (completed = true)

2. Interactive Input:
   - When a command pauses for user input and requires interaction
   - Use resume with stdin to provide the required input
   - Can be used multiple times if the command needs multiple inputs

Remember:
- Always check the response structure for execution status and hints
- Use the id from the response for resume or terminate operations
- Monitor returnReason to understand why a command stopped
- Resume can be used both for getting more output and providing input
- Commands still follow all original restrictions regarding servers and long-running processes


## read_file
Description: Request to read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.
- This tool content does not contain any linter errors, and this tool content does not change unless you change the file content using the write_to_file tool.
Parameters:
- path: (required) The path of the file to read (relative to the current working directory ${cwd.toPosix()})
Usage:
<read_file>
<path>File path here</path>
</read_file>

## edit_file_blocks
Description: Request to edit specific blocks of content within a file. This tool is used to modify existing files by replacing or deleting specific blocks of content. It is particularly useful for updating code, configuration files, or structured documents. You must provide the 'SEARCH/REPLACE' blocks representing the changes to be made to the existing file. Each 'SEARCH' block must match the existing content exactly, and each 'REPLACE' block should provide the intended changes.
This is more powerful than the write_to_file tool as it allows you to modify specific blocks of content within a file without replacing the entire file content. reduce the risk of errors and unintended changes.
A good example of using this tool is when you need to update specific functions, lines of code or configuration settings within a file without affecting the rest of the content.
Parameters:
- path: (required) The path of the file to edit (relative to the current working directory ${cwd.toPosix()})
- kodu_diff: (required) The 'SEARCH/REPLACE' blocks representing the changes to be made to the existing file. Each 'SEARCH' block must match the existing content exactly, and each 'REPLACE' block should provide the intended changes.

CRITICAL GUIDANCE FOR USING SEARCH/REPLACE:

Accurately generating 'SEARCH/REPLACE' blocks when using the edit_file_blocks tool is crucial to avoid errors and ensure modifications are correctly applied. Follow these structured steps:

## Step-by-Step Checklist for Generating 'SEARCH/REPLACE' Blocks:

1. **Read the File (if Necessary)**:
   - Did you read the file before writing to it? If not, use the 'read_file' tool first to obtain the latest content, unless you already have it from previous steps or user input.
   - Avoid unnecessary re-reads; only read again if the content is missing or has changed.

2. **Confirm the Latest Content**:
   - Ensure you have the last content from either a previous 'read_file' operation, user input, or a recent tool call.

3. **Avoid Placeholders**:
   - Do **NOT** use placeholders such as '// ...' or comments like '/ your implementation here'. The 'REPLACE' section must reflect the actual and complete intended changes.

4. **Consistent 'SEARCH/REPLACE' Blocks**:
   - Use 'SEARCH/REPLACE' blocks when modifying existing files.
   - Each 'SEARCH' block must exactly match existing content. Any deviation may lead to errors.
   - Separate the 'SEARCH' and 'REPLACE' blocks with '======='.

5. **ENSURE** that the SEARCH block contains at least 5 contiguous lines of code or additional context, such as comments, from the original file. This approach improves the reliability of matching and minimizes unintended changes during modification.
  - Always strive to capture surrounding lines that help uniquely identify the location of your intended change.
  - Contextual lines may include comments, whitespace, and code directly before or after the target change to ensure a robust match.
  - When in doubt, prioritize including more lines for context while maintaining SEARCH sections that are concise and relevant to avoid overwhelming matches.

Usage:

-- Example 1: Modifying a Variable in a File

<edit_file_blocks>
<path>src/example.js</path>
<kodu_diff>
SEARCH
// Some preceding lines for context
const a = 10;
const b = 20;
const c = 30;
const x = 42;
const y = 50;
=======
REPLACE
// Some preceding lines for context
const a = 10;
const b = 20;
const c = 30;
const x = 100; // Modified value for testing
const y = 50;
</kodu_diff>
</edit_file_blocks>

-- Example 2: Adding an Import Statement and Removing a Function

-- 1. Adding an import:

<edit_file_blocks>
<path>mathweb/flask/app.py</path>
<kodu_diff>
SEARCH
from flask import Flask
# Additional context lines for matching
def my_function():
    pass

class Example:
    def __init__(self):
        pass
=======
REPLACE
import math
from flask import Flask
# Additional context lines for matching
def my_function():
    pass

class Example:
    def __init__(self):
        pass
</kodu_diff>
</edit_file_blocks>

-- 2. Removing an existing function:

<edit_file_blocks>
<path>mathweb/flask/app.py</path>
<kodu_diff>
SEARCH
def factorial(n):
    "compute factorial"

    if n == 0:
        return 1
    else:
        return n * factorial(n-1)

# Context lines for better match
def another_function():
    print("This is a test")
=======
REPLACE
# Context lines for better match
def another_function():
    print("This is a test")
</kodu_diff>
</edit_file_blocks>

-- Example 3: Updating a Function Call

<edit_file_blocks>
<path>mathweb/flask/app.py</path>
<kodu_diff>
SEARCH
# Contextual code for better matching
def process_number(n):
    result = n * 2
    return str(factorial(n))

# More context if necessary
def another_function_call():
    pass
=======
REPLACE
# Contextual code for better matching
def process_number(n):
    result = n * 2
    return str(math.factorial(n))

# More context if necessary
def another_function_call():
    pass
</kodu_diff>
</edit_file_blocks>

-- Example 4: Creating a New File

<edit_file_blocks>
<path>hello.py</path>
<kodu_content>
def hello():
    "print a greeting"

    print("hello")
</kodu_content>
</edit_file_blocks>

-- Example 5: Modifying an Existing File to Import a Function

<edit_file_blocks>
<path>main.py</path>
<kodu_diff>
SEARCH
# Some context before the function
def hello():
    "print a greeting"

    print("hello")

# Additional context after the function
class HelloWorld:
    def greet(self):
        pass
=======
REPLACE
# Some context before the function
from hello import hello

# Additional context after the function
class HelloWorld:
    def greet(self):
        pass
</kodu_diff>
</edit_file_blocks>

-- Example 6: Multiple Hunks in a Single File

<edit_file_blocks>
<path>src/example.js</path>
<kodu_diff>
SEARCH
// Context for first change
const greet = () => {
    console.log("Hello, world!");
};
const a = 1;
const b = 2;
=======
REPLACE
// Context for first change
const greet = () => {
    console.log("Hello, OpenAI!");
};
const a = 1;
const b = 2;

SEARCH
// Context for second change
function add(a, b) {
    return a + b;
}
const c = 3;
const d = 4;
=======
REPLACE
// Context for second change
function add(a, b) {
    // Perform addition and log result
    const result = a + b;
    console.log("Result: " + result);
    return result;
}
const c = 3;
const d = 4;
</kodu_diff>
</edit_file_blocks>

Example 7 - Deleting an entire class:
<edit_file_blocks>
<path>src/services/user-service.ts</path>
<kodu_diff>
SEARCH
// User authentication service implementation
export class UserAuthService {
    private userCache: Map<string, User> = new Map();
    
    constructor(private config: AuthConfig) {
        this.initialize();
    }
    
    private async initialize() {
        // Initialize authentication service
        await this.loadUserCache();
    }
    
    public async authenticate(username: string, password: string): Promise<boolean> {
        const user = this.userCache.get(username);
        if (!user) return false;
        return await this.validateCredentials(user, password);
    }
    
    private async loadUserCache() {
        // Load user data into cache
        const users = await this.config.getUserList();
        users.forEach(user => this.userCache.set(user.name, user));
    }
}

// Keep services registry for reference
export const services = {
=======
REPLACE
// Services registry
export const services = {
</kodu_diff>
</edit_file_blocks>



## write_to_file
Description: Request to write content to a file at the specified path. write_to_file creates or replace the entire file content. you must provide the full intended content of the file in the 'content' parameter, without any truncation. This tool will automatically create any directories needed to write the file, and it will overwrite the file if it already exists. If you only want to modify an existing file blocks, you should use edit_file_blocks tool with 'SEARCH/REPLACE' blocks representing the changes to be made to the existing file.
This tool is powerful and should be used for creating new files or replacing the entire content of existing files when necessary. Always provide the complete content of the file in the 'content' parameter, without any truncation.
A good example of replacing the entire content of a file is when dealing with complex refactoring that requries a complete rewrite of the file content or a large amount of deletions and additions.
Parameters:
- path: (required) The path of the file to write to (relative to the current working directory ${cwd.toPosix()})
- kodu_content: (required when creating a new file) The COMPLETE intended content to write to the file. ALWAYS provide the COMPLETE file content in your response, without any truncation. This is NON-NEGOTIABLE, as partial updates or placeholders are STRICTLY FORBIDDEN. Example of forbidden content: '// rest of code unchanged' | '// your implementation here' | '// code here ...'. If you are writing code to a new file, you must provide the complete code, no placeholders, no partial updates; you must write all the code!
Usage:
<write_to_file>
<path>File path here</path>
<kodu_content>
Your complete file content here without any code omissions or truncations (e.g., no placeholders like '// your code here')
</kodu_content>
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

## computer_use
Description: Request to interact with a Puppeteer-controlled browser or take a screenshot of the current desktop. Every action, except \`close\`, will be responded to with a screenshot of the browser's current state, along with any new console logs. You may only perform one browser action per message, and wait for the user's response including a screenshot and logs to determine the next action.
- The sequence of actions except the \`system_screenshot\` action **must always start with** launching the browser at a URL, and **must always end with** closing the browser. If you need to visit a new URL that is not possible to navigate to from the current webpage, you must first close the browser, then launch again at the new URL.
- While the browser is active, only the \`computer_use\` tool can be used. No other tools should be called during this time. You may proceed to use other tools only after closing the browser. For example if you run into an error and need to fix a file, you must close the browser, then use other tools to make the necessary changes, then re-launch the browser to verify the result.
- The browser window has a resolution of **900x600** pixels. When performing any click actions, ensure the coordinates are within this resolution range.
- Before clicking on any elements such as icons, links, or buttons, you must consult the provided screenshot of the page to determine the coordinates of the element. The click should be targeted at the **center of the element**, not on its edges.
Parameters:
- action: (required) The action to perform. The available actions are:
    * system_screenshot: Take a screenshot of the current desktop.
    * launch: Launch a new Puppeteer-controlled browser instance at the specified URL. This **must always be the first action**.
        - Use with the \`url\` parameter to provide the URL.
        - Ensure the URL is valid and includes the appropriate protocol (e.g. http://localhost:3000/page, file:///path/to/file.html, etc.)
    * click: Click at a specific x,y coordinate.
        - Use with the \`coordinate\` parameter to specify the location.
        - Always click in the center of an element (icon, button, link, etc.) based on coordinates derived from a screenshot.
    * type: Type a string of text on the keyboard. You might use this after clicking on a text field to input text.
        - Use with the \`text\` parameter to provide the string to type.
    * scroll_down: Scroll down the page by one page height.
    * scroll_up: Scroll up the page by one page height.
    * close: Close the Puppeteer-controlled browser instance. This **must always be the final browser action**.
        - Example: \`<action>close</action>\`
- url: (optional) Use this for providing the URL for the \`launch\` action.
    * Example: <url>https://example.com</url>
- coordinate: (optional) The X and Y coordinates for the \`click\` action. Coordinates should be within the **900x600** resolution.
    * Example: <coordinate>450,300</coordinate>
- text: (optional) Use this for providing the text for the \`type\` action.
    * Example: <text>Hello, world!</text>
Usage:
<computer_use>
<action>Action to perform (e.g., system_screenshot, launch, click, type, scroll_down, scroll_up, close)</action>
<url>URL to launch the browser at (optional)</url>
<coordinate>x,y coordinates (optional)</coordinate>
<text>Text to type (optional)</text>
</computer_use>

# Tool Use Examples

## Example 0: running a simple command using execute_command

Explanation: In this example, we will run a simple command "pnpm run test" using the execute_command tool. This command will run the tests for the project.
<execute_command>
<type>execute_blocking_command</type>
<command>pnpm run test</command>
</execute_command>

## Example 1: start a development server using server_runner_tool

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

## Example 2: Requesting to write to a file

<write_to_file>
<path>frontend-config.json</path>
<kodu_content>
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
</kodu_content>
</write_to_file>

## Example 3: Editing a file block with edit_file_blocks
Explanation: In this example, we need to update a specific block of code in a file. We will use the edit_file_blocks tool to replace the existing block with the new block.
<edit_file_blocks>
<path>src/example.js</path>
<kodu_diff>
SEARCH
class Job {
    private title: string;
    private company: string;
    private location: string;
    private salary: number;
    
    constructor(title: string, company: string, location: string, salary: number) {
        this.title = title;
        this.company = company;
        this.location = location;
        this.salary = salary;
    }
=======
REPLACE
class Job {
    private title: string;
    private company: string;
    private location: string;
    private salary: number;
    private description: string;

    constructor(title: string, company: string, location: string, salary: number, description: string) {
        this.title = title;
        this.company = company;
        this.location = location;
        this.salary = salary;
        this.description = description;
    }
</kodu_diff>
</edit_file_blocks>


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