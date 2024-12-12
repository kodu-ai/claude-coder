// schema/list_code_definition_names.ts
import { z } from "zod"

/**
 * @tool list_code_definition_names
 * @description Lists definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.
 * @schema
 * {
 *   path: string; // The path of the directory to list code definitions for.
 * }
 * @example
 * ```xml
 * <tool name="list_code_definition_names">
 *   <path>/src</path>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="list_code_definition_names">
 *   <path>/lib</path>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="list_code_definition_names">
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
	`<tool name="list_code_definition_names">
  <path>/src</path>
</tool>`,

	`<tool name="list_code_definition_names">
  <path>/lib</path>
</tool>`,

	`<tool name="list_code_definition_names">
  <path>/components</path>
</tool>`,
]

export const listCodeDefinitionNamesTool = {
	schema: {
		name: "list_code_definition_names",
		schema,
	},
	examples,
}

export type ListCodeDefinitionNamesToolParams = {
	name: "list_code_definition_names"
	input: z.infer<typeof schema>
}
