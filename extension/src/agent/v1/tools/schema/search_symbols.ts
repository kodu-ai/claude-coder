// schema/search_symbol.ts
import { z } from "zod"

/**
 * @tool search_symbol
 * @description Request to find and understand code symbols (functions, classes, methods) across the entire codebase. This tool helps navigate and understand code structure by finding symbol definitions and their context, including all usages and definitions.
 * @schema
 * {
 *   symbolName: string;     // The name of the symbol to search for (e.g., function name, class name)
 * }
 * @example
 * ```xml
 * <tool name="search_symbol">
 *   <symbolName>handleRequest</symbolName>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="search_symbol">
 *   <symbolName>UserService</symbolName>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="search_symbol">
 *   <symbolName>processData</symbolName>
 * </tool>
 * ```
 */
const schema = z.object({
	symbolName: z.string().describe("The name of the symbol to search for (e.g., function name, class name)"),
})

const examples = [
	`<tool name="search_symbol">
  <symbolName>handleRequest</symbolName>
</tool>`,

	`<tool name="search_symbol">
  <symbolName>UserService</symbolName>
</tool>`,

	`<tool name="search_symbol">
  <symbolName>processData</symbolName>
</tool>`,
]

export const searchSymbolTool = {
	schema: {
		name: "search_symbol",
		schema,
	},
	examples,
}

export type SearchSymbolsToolParams = {
	name: "search_symbol"
	input: z.infer<typeof schema>
}
