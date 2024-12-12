// schema/explore_repo_folder.ts
import { z } from "zod"

/**
 * @tool explore_repo_folder
 * @description Lists definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.
 * @schema
 * {
 *   path: string; // The path of the directory to list code definitions for.
 * }
 * @example
 * ```xml
 * <tool name="explore_repo_folder">
 *   <path>/src</path>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="explore_repo_folder">
 *   <path>/lib</path>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="explore_repo_folder">
 *   <path>/components</path>
 * </tool>
 * ```
 */
const schema = z.object({
	path: z
		.string()
		.describe(
			"The path of the directory (relative to the current working directory) to list top-level source code definitions for."
		),
})

const examples = [
	`<tool name="explore_repo_folder">
  <path>/src</path>
</tool>`,

	`<tool name="explore_repo_folder">
  <path>/lib</path>
</tool>`,

	`<tool name="explore_repo_folder">
  <path>/components</path>
</tool>`,
]

export const ExploreRepoFolderTool = {
	schema: {
		name: "explore_repo_folder",
		schema,
	},
	examples,
}

export type ExploreRepoFolderToolParams = {
	name: "explore_repo_folder"
	input: z.infer<typeof schema>
}
