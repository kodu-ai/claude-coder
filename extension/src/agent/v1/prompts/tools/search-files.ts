import { ToolPromptSchema } from "../utils/utils"

export const searchFilesPrompt: ToolPromptSchema = {
	name: "search_files",
	description:
		"Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.",
	parameters: {
		path: {
			type: "string",
			description: `The path of the directory to search in (relative to the current working directory {{cwd}}). This directory will be recursively searched.`,
			required: true,
		},
		regex: {
			type: "string",
			description: "The regular expression pattern to search for. Uses Rust regex syntax.",
			required: true,
		},
		file_pattern: {
			type: "string",
			description:
				"Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).",
			required: false,
		},
	},
	capabilities: [
		"You can use search_files tool to perform regex searches across files in a specified directory, outputting context-rich results that include surrounding lines. This is particularly useful for understanding code patterns, finding specific implementations, or identifying areas that need refactoring.",
	],
	examples: [
		{
			description: "Search for files",
			output: `<search_files>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
</search_files>`,
		},
	],
}
