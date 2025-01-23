import { ToolPromptSchema } from "../utils/utils"

export const readFilePrompt: ToolPromptSchema = {
	name: "read_file",
	description:
		"Request to read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.",
	parameters: {
		path: {
			type: "string",
			description: `The path of the file to read (relative to the current working directory {{cwd}})`,
			required: true,
		},
	},
	capabilities: [
		"You can use read_file tool to read the contents of a file at the specified path and time, this tool is useful when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files.",
		"When you use read_file tool, it will automatically extracts raw text from PDF and DOCX files, but may not be suitable for other types of binary files, as it returns the raw content as a string.",
	],
	examples: [
		{
			description: "Read a file",
			output: `<read_file>
<path>File path here</path>
</read_file>`,
		},
	],
}
