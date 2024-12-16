// schema/url_screenshot.ts
import { z } from "zod"

/**
 * @tool url_screenshot
 * @description Returns a screenshot of a URL provided. This can be used when the user wants to make a design similar to the provided URL.
 * @schema
 * {
 *   url: string; // The URL provided by the user.
 * }
 * @example
 * ```xml
 * <tool name="url_screenshot">
 *   <url>https://www.example.com</url>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="url_screenshot">
 *   <url>https://www.companysite.com/about</url>
 * </tool>`
 * @example
 * ```xml
 * <tool name="url_screenshot">
 *   <url>https://www.designinspiration.com/portfolio</url>
 * </tool>
 * ```
 */
const schema = z.object({
	url: z.string().describe("The URL provided by the user."),
})

const examples = [
	`<tool name="url_screenshot">
  <url>https://www.example.com</url>
</tool>`,

	`<tool name="url_screenshot">
  <url>https://www.companysite.com/about</url>
</tool>`,

	`<tool name="url_screenshot">
  <url>https://www.designinspiration.com/portfolio</url>
</tool>`,
]

export type UrlScreenshotParams = z.infer<typeof schema>

export const urlScreenshotTool = {
	schema: {
		name: "url_screenshot",
		schema,
	},
	examples,
}

export type UrlScreenshotToolParams = {
	name: "url_screenshot"
	input: z.infer<typeof schema>
}
