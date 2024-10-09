import { z } from "zod"
import { Tool } from "../../../shared/Tool"
import { cwd } from "../utils"

// to be merged
// Merged result
export const uDifftools: Tool[] = [
	{
		name: "execute_command",
		description: `Execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will be executed in the current working directory: ${cwd}`,
		input_schema: {
			type: "object",
			properties: {
				command: {
					type: "string",
					description:
						"The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.",
				},
			},
			required: ["command"],
		},
	},
	{
		name: "list_files",
		description:
			"List files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the directory to list contents for (relative to the current working directory ${cwd})`,
				},
				recursive: {
					type: "string",
					enum: ["true", "false"],
					description:
						"Whether to list files recursively. Use 'true' for recursive listing, 'false' or omit for top-level only.",
				},
			},
			required: ["path"],
		},
	},
	{
		name: "list_code_definition_names",
		description:
			"Lists definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the directory (relative to the current working directory ${cwd}) to list top level source code definitions for`,
				},
			},
			required: ["path"],
		},
	},
	{
		name: "search_files",
		description:
			"Perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the directory to search in (relative to the current working directory ${cwd}). This directory will be recursively searched.`,
				},
				regex: {
					type: "string",
					description: "The regular expression pattern to search for. Uses Rust regex syntax.",
				},
				filePattern: {
					type: "string",
					description:
						"Optional glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).",
				},
			},
			required: ["path", "regex"],
		},
	},
	{
		name: "read_file",
		description:
			"Read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file, for example to analyze code, review text files, or extract information from configuration files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the file to read (relative to the current working directory ${cwd})`,
				},
			},
			required: ["path"],
		},
	},
	{
		name: "write_to_file",
		description:
			"Write new file at the specified path. If the file exists, it will throw an error. If the file doesn't exist, it will be created. Always provide the full intended content of the file, without any truncation. This tool will automatically create any directories needed to write the file.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the file to write to (relative to the current working directory ${cwd})`,
				},
				content: {
					type: "string",
					description: "The full content to write to the file.",
				},
			},
			required: ["path", "content"],
		},
	},
	{
		name: "update_file",
		description: `Update an existing file at the specified path by applying a unified diff (udiff). This tool allows you to modify the content of an existing file by specifying the exact changes in udiff format. The udiff should be a valid unified diff that accurately represents the changes to be made to the file line by line. You must carefully construct the udiff to ensure that the changes are applied correctly and accurately. This tool will automatically create any directories needed to update the file.`,
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the file to update (relative to the current working directory '${cwd}').`,
				},
				udiff: {
					type: "string",
					description: `
	  The unified diff (udiff) to apply to the file. This should be a valid udiff that specifies the changes line by line. Before calling this tool, you must use <thinking></thinking> tags to plan the changes you want to make to the file, including the specific lines to add, remove, or modify.
	  
	  **Important Notes:**
	  
	  - **Accurate Context:** Ensure that the udiff includes the correct context lines and line numbers to prevent patch failures.
	  - **No Placeholders:** Do not use placeholders like \`// ...\` or \`// rest of code unchanged\`; provide all necessary code explicitly.
	  - **Line Endings:** Be consistent with line endings to avoid unintended changes.
	  - **Testing the Patch:** If possible, simulate applying the udiff to ensure it works correctly.
	  
	  **Example Interaction:**
	  
	  - **User:**
	  
		Replace the custom \`is_prime\` function with a call to \`sympy.isprime\`.
	  
	  - **Assistant:**
	  
		<thinking>
		1. Identify the file containing the \`is_prime\` function, e.g., \`mathweb/flask/app.py\`.
		2. Plan the changes:
		   - Add an import statement for \`sympy\`.
		   - Remove the \`is_prime\` function definition.
		   - Modify any calls to \`is_prime()\` to use \`sympy.isprime()\`.
		</thinking>
	  
		Here is the udiff for the changes:
	  
		\`\`\`udiff
		--- mathweb/flask/app.py
		+++ mathweb/flask/app.py
		@@ -1,5 +1,6 @@
		+import sympy
	  
		 from flask import Flask
		 app = Flask(__name__)
	  
		@@ -10,15 +11,6 @@
		 # Other code
	  
		-def is_prime(x):
		-    if x < 2:
		-        return False
		-    for i in range(2, int(math.sqrt(x)) + 1):
		-        if x % i == 0:
		-            return False
		-    return True
	  
		 @app.route('/prime/<int:n>')
		 def nth_prime(n):
		@@ -26,7 +18,7 @@
			 num = 1
			 while count < n:
				 num += 1
		-        if is_prime(num):
		+        if sympy.isprime(num):
					 count += 1
			 return str(num)
		\`\`\`
	  `,
				},
			},
			required: ["path", "udiff"],
		},
	},
	{
		name: "ask_followup_question",
		description:
			"Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively. It allows for interactive problem-solving by enabling direct communication with the user. Use this tool judiciously to maintain a balance between gathering necessary information and avoiding excessive back-and-forth.",
		input_schema: {
			type: "object",
			properties: {
				question: {
					type: "string",
					description:
						"The question to ask the user. This should be a clear, specific question that addresses the information you need.",
				},
			},
			required: ["question"],
		},
	},
	{
		name: "attempt_completion",
		description:
			"Once you've completed the task, use this tool to present the result to the user. They may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.",
		input_schema: {
			type: "object",
			properties: {
				command: {
					type: "string",
					description:
						"The CLI command to execute to show a live demo of the result to the user. For example, use 'open index.html' to display a created website. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.",
				},
				result: {
					type: "string",
					description:
						"The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.",
				},
			},
			required: ["result"],
		},
	},
	{
		name: "web_search",
		description: `Let's you ask a question about links and generate a short summary of information regarding a question,
			you can provide a link to access directly or a search query,
			at both stages you are required to provide a general question about this web search.`,
		input_schema: {
			type: "object",
			properties: {
				searchQuery: {
					type: "string",
					description: "The question you want to search for on the web. ",
				},
				baseLink: {
					type: "string",
					description:
						"The base link provided by the user. If it is provided, you can start your search from here.",
				},
			},
			required: ["searchQuery"],
		},
	},
	{
		name: "url_screenshot",
		description: `Returns a screenshot of a URL provided.
		This can be used when the user wants to make a design similar to the provided url.`,
		input_schema: {
			type: "object",
			properties: {
				url: {
					type: "string",
					description: "The url provided by the user",
				},
			},
			required: ["searchQuery"],
		},
	},
	{
		name: "ask_consultant",
		description: `Allows you talk to an expert software consultant for help or direction when you're unable to solve a bug or need assistance.`,
		input_schema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "The question or issue you want to ask the consultant.",
				},
			},
			required: ["query"],
		},
	},
]

export const tools: Tool[] = [
	{
		name: "execute_command",
		description: `Execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will be executed in the current working directory: ${cwd}`,
		input_schema: {
			type: "object",
			properties: {
				command: {
					type: "string",
					description:
						"The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.",
				},
			},
			required: ["command"],
		},
	},
	{
		name: "list_files",
		description:
			"List files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the directory to list contents for (relative to the current working directory ${cwd})`,
				},
				recursive: {
					type: "string",
					enum: ["true", "false"],
					description:
						"Whether to list files recursively. Use 'true' for recursive listing, 'false' or omit for top-level only.",
				},
			},
			required: ["path"],
		},
	},
	{
		name: "list_code_definition_names",
		description:
			"Lists definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the directory (relative to the current working directory ${cwd}) to list top level source code definitions for`,
				},
			},
			required: ["path"],
		},
	},
	{
		name: "search_files",
		description:
			"Perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the directory to search in (relative to the current working directory ${cwd}). This directory will be recursively searched.`,
				},
				regex: {
					type: "string",
					description: "The regular expression pattern to search for. Uses Rust regex syntax.",
				},
				filePattern: {
					type: "string",
					description:
						"Optional glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).",
				},
			},
			required: ["path", "regex"],
		},
	},
	{
		name: "read_file",
		description:
			"Read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file, for example to analyze code, review text files, or extract information from configuration files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the file to read (relative to the current working directory ${cwd})`,
				},
			},
			required: ["path"],
		},
	},
	{
		name: "write_to_file",
		description:
			"Write content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. Always provide the full intended content of the file, without any truncation. This tool will automatically create any directories needed to write the file.",
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: `The path of the file to write to (relative to the current working directory ${cwd})`,
				},
				content: {
					type: "string",
					description: "The full content to write to the file.",
				},
			},
			required: ["path", "content"],
		},
	},
	{
		name: "ask_followup_question",
		description:
			"Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively. It allows for interactive problem-solving by enabling direct communication with the user. Use this tool judiciously to maintain a balance between gathering necessary information and avoiding excessive back-and-forth.",
		input_schema: {
			type: "object",
			properties: {
				question: {
					type: "string",
					description:
						"The question to ask the user. This should be a clear, specific question that addresses the information you need.",
				},
			},
			required: ["question"],
		},
	},
	{
		name: "attempt_completion",
		description:
			"Once you've completed the task, use this tool to present the result to the user. They may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.",
		input_schema: {
			type: "object",
			properties: {
				command: {
					type: "string",
					description:
						"The CLI command to execute to show a live demo of the result to the user. For example, use 'open index.html' to display a created website. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.",
				},
				result: {
					type: "string",
					description:
						"The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.",
				},
			},
			required: ["result"],
		},
	},
	{
		name: "web_search",
		description: `Let's you ask a question about links and generate a short summary of information regarding a question,
			you can provide a link to access directly or a search query,
			at both stages you are required to provide a general question about this web search.`,
		input_schema: {
			type: "object",
			properties: {
				searchQuery: {
					type: "string",
					description: "The question you want to search for on the web. ",
				},
				baseLink: {
					type: "string",
					description:
						"The base link provided by the user. If it is provided, you can start your search from here.",
				},
			},
			required: ["searchQuery"],
		},
	},
	{
		name: "url_screenshot",
		description: `Returns a screenshot of a URL provided.
		This can be used when the user wants to make a design similar to the provided url.`,
		input_schema: {
			type: "object",
			properties: {
				url: {
					type: "string",
					description: "The url provided by the user",
				},
			},
			required: ["searchQuery"],
		},
	},
	{
		name: "ask_consultant",
		description: `Allows you talk to an expert software consultant for help or direction when you're unable to solve a bug or need assistance.`,
		input_schema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "The question or issue you want to ask the consultant.",
				},
			},
			required: ["query"],
		},
	},
]
