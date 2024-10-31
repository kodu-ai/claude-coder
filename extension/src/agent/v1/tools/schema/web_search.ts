// schema/web_search.ts
import { z } from "zod"

/**
 * @tool web_search
 * @description Lets you ask a question about links and generate a short summary of information regarding a question. You can provide a link to access directly or a search query. At both stages, you are required to provide a general question about this web search.
 * @schema
 * {
 *   searchQuery: string; // The question you want to search for on the web.
 *   baseLink?: string;   // Optional base link provided by the user.
 * }
 * @example
 * ```xml
 * <tool name="web_search">
 *   <searchQuery>Latest advancements in AI technology</searchQuery>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="web_search">
 *   <searchQuery>How to optimize React applications?</searchQuery>
 *   <baseLink>https://reactjs.org/docs/optimizing-performance.html</baseLink>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="web_search">
 *   <searchQuery>Best practices for REST API design</searchQuery>
 * </tool>
 * ```
 */
const schema = z.object({
	searchQuery: z.string().describe("The question you want to search for on the web."),
	baseLink: z
		.string()
		.optional()
		.describe("The base link provided by the user. If it is provided, you can start your search from here."),
	browserModel: z
		.enum(["smart", "fast"])
		.default("fast")
		.optional()
		.describe(
			"The browser model to use for the search. Use 'smart' for slower but smarter search, use 'fast' for faster but less smart search."
		),
})

const examples = [
	`<tool name="web_search">
  <searchQuery>Latest advancements in AI technology</searchQuery>
  <browserModel>smart</browserModel>
</tool>`,

	`<tool name="web_search">
  <searchQuery>How to optimize React applications?</searchQuery>
  <baseLink>https://reactjs.org/docs/optimizing-performance.html</baseLink>
  <browserModel>smart</browserModel>
</tool>`,

	`<tool name="web_search">
  <searchQuery>Best practices for REST API design</searchQuery>
</tool>`,

	`<tool name="web_search">
  <searchQuery>Fixing type error in my code</searchQuery>
  <browserModel>fast</browserModel>
</tool>`,
]

export const webSearchTool = {
	schema: {
		name: "web_search",
		schema,
	},
	examples,
}
