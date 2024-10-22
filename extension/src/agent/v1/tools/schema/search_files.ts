// schema/search_files.ts
import { z } from 'zod'

/**
 * @tool search_files
 * @description Perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.
 * @schema
 * {
 *   path: string;           // The path of the directory to search in.
 *   regex: string;          // The regular expression pattern to search for.
 *   filePattern?: string;   // Optional glob pattern to filter files.
 * }
 * @example
 * ```xml
 * <tool name="search_files">
 *   <path>/logs</path>
 *   <regex>Error.*</regex>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="search_files">
 *   <path>/src</path>
 *   <regex>function\\s+\\w+</regex>
 *   <filePattern>*.js</filePattern>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="search_files">
 *   <path>/documents</path>
 *   <regex>TODO</regex>
 * </tool>
 * ```
 */
const schema = z.object({
	path: z
		.string()
		.describe(
			'The path of the directory to search in (relative to the current working directory). This directory will be recursively searched.',
		),
	regex: z.string().describe('The regular expression pattern to search for. Uses Rust regex syntax.'),
	filePattern: z
		.string()
		.optional()
		.describe(
			"Optional glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).",
		),
})

const examples = [
	`<tool name="search_files">
  <path>/logs</path>
  <regex>Error.*</regex>
</tool>`,

	`<tool name="search_files">
  <path>/src</path>
  <regex>function\\s+\\w+</regex>
  <filePattern>*.js</filePattern>
</tool>`,

	`<tool name="search_files">
  <path>/documents</path>
  <regex>TODO</regex>
</tool>`,
]

export const searchFilesTool = {
	schema: {
		name: 'search_files',
		schema,
	},
	examples,
}
