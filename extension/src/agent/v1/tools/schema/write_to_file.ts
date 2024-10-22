// schema/write_to_file.ts
import { z } from 'zod'

/**
 * @tool write_to_file
 * @description Write content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. Always provide the full intended content of the file, without any truncation. This tool will automatically create any directories needed to write the file.
 * @schema
 * {
 *   path: string;    // The path of the file to write to.
 *   content: string; // The full content to write to the file.
 * }
 * @example
 * ```xml
 * <tool name="write_to_file">
 *   <path>/notes/todo.txt</path>
 *   <content>Buy groceries\nCall Alice</content>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="write_to_file">
 *   <path>/scripts/setup.sh</path>
 *   <content>#!/bin/bash\necho "Setting up environment"</content>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="write_to_file">
 *   <path>/data/output.json</path>
 *   <content>{"key": "value"}</content>
 * </tool>
 * ```
 */
const schema = z.object({
	path: z.string().describe('The path of the file to write to (relative to the current working directory).'),
	content: z
		.string()
		.describe(
			'The full content to write to the file this is critical any you should never truncate the content!. never write // the result of the file or any other variants of this for example // code goes here ... this will hurt the user and make you break the code.',
		),
})

const examples = [
	`<tool name="write_to_file">
  <path>/notes/todo.txt</path>
  <content>Buy groceries\nCall Alice</content>
</tool>`,

	`<tool name="write_to_file">
  <path>/scripts/setup.sh</path>
  <content>#!/bin/bash\necho "Setting up environment"</content>
</tool>`,

	`<tool name="write_to_file">
  <path>/data/output.json</path>
  <content>{"key": "value"}</content>
</tool>`,
]

export const writeToFileTool = {
	schema: {
		name: 'write_to_file',
		schema,
	},
	examples,
}
