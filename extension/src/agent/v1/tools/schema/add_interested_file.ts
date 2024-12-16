// schema/add_interested_file.ts
import { z } from "zod"

/**
 * @tool add_interested_file
 * @description Track files that are relevant to the current task. This tool helps maintain context by tracking file dependencies and documenting why files are important.
 * @schema
 * {
 *   path: string;     // The path of the file to track
 *   why: string;      // Explanation of why this file is relevant to the current task
 * }
 * @example
 * ```xml
 * <tool name="add_interested_file">
 *   <path>/src/services/auth.ts</path>
 *   <why>Contains authentication logic that needs to be modified for the new feature</why>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="add_interested_file">
 *   <path>/src/types/user.ts</path>
 *   <why>Defines user interface that will be extended with new properties</why>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="add_interested_file">
 *   <path>/src/utils/validation.ts</path>
 *   <why>Contains validation helpers that will be reused in the new feature</why>
 * </tool>
 * ```
 */
const schema = z.object({
	path: z.string().describe("The path of the file to track (relative to the current working directory)"),
	why: z.string().describe("Explanation of why this file is relevant to the current task"),
})

const examples = [
	`<tool name="add_interested_file">
  <path>/src/services/auth.ts</path>
  <why>Contains authentication logic that needs to be modified for the new feature</why>
</tool>`,

	`<tool name="add_interested_file">
  <path>/src/types/user.ts</path>
  <why>Defines user interface that will be extended with new properties</why>
</tool>`,

	`<tool name="add_interested_file">
  <path>/src/utils/validation.ts</path>
  <why>Contains validation helpers that will be reused in the new feature</why>
</tool>`,
]

export const addInterestedFileTool = {
	schema: {
		name: "add_interested_file",
		schema,
	},
	examples,
}

export type AddInterestedFileToolParams = {
	name: "add_interested_file"
	input: z.infer<typeof schema>
}
