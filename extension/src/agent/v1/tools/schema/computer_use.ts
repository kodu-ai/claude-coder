// schema/computer_use.ts
import { computerUseActions } from "../../../../shared/new-tools"
import { z } from "zod"

/**
 * @tool computer_use
 * @description Returns a screenshot of a URL provided. This can be used when the user wants to make a design similar to the provided URL.
 * @schema
 * {
 *   url: string; // The URL provided by the user.
 * }
 * @example
 * ```xml
 * <tool name="computer_use">
 *   <url>https://www.example.com</url>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="computer_use">
 *   <url>https://www.companysite.com/about</url>
 * </tool>`
 * @example
 * ```xml
 * <tool name="computer_use">
 *   <url>https://www.designinspiration.com/portfolio</url>
 * </tool>
 * ```
 */
const schema = z.object({
	action: z.enum(computerUseActions).describe("The action to perform."),
	url: z.string().describe("The URL to launch the browser at (optional).").optional(),
	coordinate: z.string().describe("The x,y coordinates for the click action (optional).").optional(),
	text: z.string().describe("The text to type (optional).").optional(),
})

const examples = [
	`<tool name="computer_use">
  <action>system_screenshot</action>
</tool>`,

	`<tool name="computer_use">
  <action>launch</action>
  <url>https://www.example.com</url>
</tool>`,

	`<tool name="computer_use">
  <action>click</action>
  <coordinate>450,300</coordinate>
</tool>`,

	`<tool name="computer_use">
  <action>type</action>
  <text>Hello, world!</text>
</tool>`,
]

export const computerUseTool = {
	schema: {
		name: "computer_use",
		schema,
	},
	examples,
}
