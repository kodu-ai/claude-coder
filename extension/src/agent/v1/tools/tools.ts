import { z } from 'zod'
import type { Tool } from '../../../shared/Tool'
import { cwd } from '../utils'

export const tools: Tool[] = [
	{
		name: 'execute_command',
		description: `Execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will be executed in the current working directory: ${cwd}`,
		input_schema: {
			type: 'object',
			properties: {
				command: {
					type: 'string',
					description:
						'The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.',
				},
			},
			required: ['command'],
		},
	},
	{
		name: 'list_files',
		description:
			'List files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents.',
		input_schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: `The path of the directory to list contents for (relative to the current working directory ${cwd})`,
				},
				recursive: {
					type: 'string',
					enum: ['true', 'false'],
					description:
						"Whether to list files recursively. Use 'true' for recursive listing, 'false' or omit for top-level only.",
				},
			},
			required: ['path'],
		},
	},
	{
		name: 'list_code_definition_names',
		description:
			'Lists definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.',
		input_schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: `The path of the directory (relative to the current working directory ${cwd}) to list top level source code definitions for`,
				},
			},
			required: ['path'],
		},
	},
	{
		name: 'search_files',
		description:
			'Perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.',
		input_schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: `The path of the directory to search in (relative to the current working directory ${cwd}). This directory will be recursively searched.`,
				},
				regex: {
					type: 'string',
					description: 'The regular expression pattern to search for. Uses Rust regex syntax.',
				},
				filePattern: {
					type: 'string',
					description:
						"Optional glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).",
				},
			},
			required: ['path', 'regex'],
		},
	},
	{
		name: 'read_file',
		description:
			'Read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file, for example to analyze code, review text files, or extract information from configuration files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.',
		input_schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: `The path of the file to read (relative to the current working directory ${cwd})`,
				},
			},
			required: ['path'],
		},
	},
	{
		name: 'write_to_file',
		description:
			"Write content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. Always provide the full intended content of the file, without any truncation. This tool will automatically create any directories needed to write the file.",
		input_schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: `The path of the file to write to (relative to the current working directory ${cwd})`,
				},
				content: {
					type: 'string',
					description: 'The full content to write to the file.',
				},
			},
			required: ['path', 'content'],
		},
	},
	{
		name: 'ask_followup_question',
		description:
			'Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively. It allows for interactive problem-solving by enabling direct communication with the user. Use this tool judiciously to maintain a balance between gathering necessary information and avoiding excessive back-and-forth.',
		input_schema: {
			type: 'object',
			properties: {
				question: {
					type: 'string',
					description:
						'The question to ask the user. This should be a clear, specific question that addresses the information you need.',
				},
			},
			required: ['question'],
		},
	},
	{
		name: 'attempt_completion',
		description:
			"Once you've completed the task, use this tool to present the result to the user. They may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.",
		input_schema: {
			type: 'object',
			properties: {
				command: {
					type: 'string',
					description:
						"The CLI command to execute to show a live demo of the result to the user. For example, use 'open index.html' to display a created website. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.",
				},
				result: {
					type: 'string',
					description:
						"The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.",
				},
			},
			required: ['result'],
		},
	},
	{
		name: 'web_search',
		description: `Let's you ask a question about links and generate a short summary of information regarding a question,
			you can provide a link to access directly or a search query,
			at both stages you are required to provide a general question about this web search.`,
		input_schema: {
			type: 'object',
			properties: {
				searchQuery: {
					type: 'string',
					description: 'The question you want to search for on the web. ',
				},
				baseLink: {
					type: 'string',
					description:
						'The base link provided by the user. If it is provided, you can start your search from here.',
				},
			},
			required: ['searchQuery'],
		},
	},
	{
		name: 'url_screenshot',
		description: `Returns a screenshot of a URL provided.
		This can be used when the user wants to make a design similar to the provided url.`,
		input_schema: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					description: 'The url provided by the user',
				},
			},
			required: ['searchQuery'],
		},
	},
	{
		name: 'ask_consultant',
		description: `Allows you talk to an expert software consultant for help or direction when you're unable to solve a bug or need assistance.`,
		input_schema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The question or issue you want to ask the consultant.',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'upsert_memory',
		description: `Allows you to create or update the task history with a summary of changes and the complete content of the task history in markdown.
		The tasks history tracks your progress and changes made to the task over time. it should also include notes and memories for future reference. that you can refer back to when needed.`,
		input_schema: {
			type: 'object',
			properties: {
				milestoneName: {
					type: 'string',
					description: 'The name of the milestone achieved, around 30 characters.',
				},
				summary: {
					type: 'string',
					description: 'The summary of changes made in each update to the task history.',
				},
				content: {
					type: 'string',
					description: 'The complete content of the updated task history to be written in markdown.',
				},
			},
			required: ['summary', 'content'],
		},
	},
]
