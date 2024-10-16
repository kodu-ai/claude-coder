// schema/attempt_completion.ts
import { z } from "zod"

/**
 * @tool attempt_completion
 * @description Once you've completed the task, use this tool to present the result to the user. They may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.
 * @schema
 * {
 *   result: string;        // The result of the task.
 *   command?: string;      // Optional CLI command to show a live demo.
 * }
 * @example
 * ```xml
 * <tool name="attempt_completion">
 *   <result>The requested feature has been implemented successfully.</result>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="attempt_completion">
 *   <result>The website is ready for review.</result>
 *   <command>open index.html</command>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="attempt_completion">
 *   <result>The data analysis is complete. Please find the report attached.</result>
 * </tool>
 * ```
 */
const schema = z.object({
	result: z
		.string()
		.describe(
			"The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance."
		),
	command: z
		.string()
		.optional()
		.describe(
			'The CLI command to execute to show a live demo of the result to the user. For example, use "open index.html" to display a created website. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.'
		),
})

const examples = [
	`<tool name="attempt_completion">
  <result>The requested feature has been implemented successfully.</result>
</tool>`,

	`<tool name="attempt_completion">
  <result>The website is ready for review.</result>
  <command>open index.html</command>
</tool>`,

	`<tool name="attempt_completion">
  <result>The data analysis is complete. Please find the report attached.</result>
</tool>`,
]

export const attemptCompletionTool = {
	schema: {
		name: "attempt_completion",
		schema,
	},
	examples,
}
