import { ToolPromptSchema } from "../utils/types"

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
		pageNumber: {
			type: "string",
			description: "The page number to read from a file",
			required: true,
		},
		readAllPages: {
			type: "string",
			description: "Read all pages of a file",
			required: false,
		},
	},
	capabilities: [
		"You can use read_file tool to read the contents of a file at the specified path and time, this tool is useful when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files, you should read only the first page and then decide if you need to read next page or all pages or not, this will help you reduce over reading meaningless content.",
		"When you use read_file tool, it will automatically extracts raw text from PDF and DOCX files, but may not be suitable for other types of binary files, as it returns the raw content as a string.",
		"When you use read_file tool, it will automatically break the content of the file into pages, you can specify the page number to read from a file, or you can read all pages of a file. you can only specify one of the two options.",
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
