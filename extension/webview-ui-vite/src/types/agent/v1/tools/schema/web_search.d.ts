import { z } from "zod";
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
declare const schema: z.ZodObject<{
    searchQuery: z.ZodString;
    baseLink: z.ZodOptional<z.ZodString>;
    browserModel: z.ZodOptional<z.ZodDefault<z.ZodEnum<["smart", "fast"]>>>;
    browserMode: z.ZodOptional<z.ZodDefault<z.ZodEnum<["api_docs", "generic"]>>>;
}, "strip", z.ZodTypeAny, {
    searchQuery: string;
    baseLink?: string | undefined;
    browserModel?: "smart" | "fast" | undefined;
    browserMode?: "api_docs" | "generic" | undefined;
}, {
    searchQuery: string;
    baseLink?: string | undefined;
    browserModel?: "smart" | "fast" | undefined;
    browserMode?: "api_docs" | "generic" | undefined;
}>;
export declare const webSearchTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            searchQuery: z.ZodString;
            baseLink: z.ZodOptional<z.ZodString>;
            browserModel: z.ZodOptional<z.ZodDefault<z.ZodEnum<["smart", "fast"]>>>;
            browserMode: z.ZodOptional<z.ZodDefault<z.ZodEnum<["api_docs", "generic"]>>>;
        }, "strip", z.ZodTypeAny, {
            searchQuery: string;
            baseLink?: string | undefined;
            browserModel?: "smart" | "fast" | undefined;
            browserMode?: "api_docs" | "generic" | undefined;
        }, {
            searchQuery: string;
            baseLink?: string | undefined;
            browserModel?: "smart" | "fast" | undefined;
            browserMode?: "api_docs" | "generic" | undefined;
        }>;
    };
    examples: string[];
};
export type WebSearchToolParams = {
    name: "web_search";
    input: z.infer<typeof schema>;
};
export {};
