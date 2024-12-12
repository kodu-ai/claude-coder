// schema/list_files.ts
import { z } from "zod"

/**
 * @tool list_files
 * @description List files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents.
 * @schema
 * {
 *   path: string;       // The path of the directory to list contents for.
 *   recursive?: string; // Optional. Use 'true' for recursive listing.
 * }
 * @example
 * ```xml
 * <tool name="list_files">
 *   <path>/documents</path>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="list_files">
 *   <path>/projects</path>
 *   <recursive>true</recursive>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="list_files">
 *   <path>.</path>
 * </tool>
 * ```
 */
const schema = z.object({
	path: z
		.string()
		.describe("The path of the directory to list contents for (relative to the current working directory)."),
	recursive: z
		.enum(["true", "false"])
		.optional()
		.describe(
			"Whether to list files recursively. Use 'true' for recursive listing, 'false' or omit for top-level only."
		),
})

const examples = [
	`<tool name="list_files">
  <path>/documents</path>
</tool>`,

	`<tool name="list_files">
  <path>/projects</path>
  <recursive>true</recursive>
</tool>`,

	`<tool name="list_files">
  <path>.</path>
</tool>`,
]

export const listFilesTool = {
	schema: {
		name: "list_files",
		schema,
	},
	examples,
}

export type ListFilesToolParams = {
	name: "list_files"
	input: z.infer<typeof schema>
}
