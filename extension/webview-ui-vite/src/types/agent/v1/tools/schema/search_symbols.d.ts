import { z } from "zod";
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
declare const schema: z.ZodObject<{
    symbolName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbolName: string;
}, {
    symbolName: string;
}>;
export declare const searchSymbolTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            symbolName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            symbolName: string;
        }, {
            symbolName: string;
        }>;
    };
    examples: string[];
};
export type SearchSymbolsToolParams = {
    name: "search_symbol";
    input: z.infer<typeof schema>;
};
export {};
