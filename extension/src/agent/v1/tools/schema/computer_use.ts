// schema/computer_use.ts
import { z } from "zod"

/**
 * the actions that can be performed by the computer_use tool
 */
export const computerUseActions = [
	"launch",
	"system_screenshot",
	"click",
	"type",
	"scroll_down",
	"scroll_up",
	"close",
	"refresh",
] as const

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
	url: z.string().describe("The URL to launch the browser at or scorll to (optional).").optional(),
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

export type ComputerUseParams = z.infer<typeof schema>

export const computerUseTool = {
	schema: {
		name: "computer_use",
		schema,
	},
	examples,
}

export type ComputerUseAction = (typeof computerUseActions)[number]
export type BrowserAction = Exclude<ComputerUseAction, "system_screenshot">
