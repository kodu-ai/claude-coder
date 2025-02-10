import { z } from "zod";
/**
 * @tool search_files
 * @description Perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.
 * @schema
 * {
 *   path: string;           // The path of the directory to search in.
 *   regex: string;          // The regular expression pattern to search for.
 *   filePattern?: string;   // Optional glob pattern to filter files.
 * }
 * @example
 * ```xml
 * <tool name="search_files">
 *   <path>/logs</path>
 *   <regex>Error.*</regex>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="search_files">
 *   <path>/src</path>
 *   <regex>function\\s+\\w+</regex>
 *   <filePattern>*.js</filePattern>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="search_files">
 *   <path>/documents</path>
 *   <regex>TODO</regex>
 * </tool>
 * ```
 */
declare const schema: z.ZodObject<{
    path: z.ZodString;
    regex: z.ZodString;
    filePattern: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    regex: string;
    filePattern?: string | undefined;
}, {
    path: string;
    regex: string;
    filePattern?: string | undefined;
}>;
export declare const searchFilesTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            path: z.ZodString;
            regex: z.ZodString;
            filePattern: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            regex: string;
            filePattern?: string | undefined;
        }, {
            path: string;
            regex: string;
            filePattern?: string | undefined;
        }>;
    };
    examples: string[];
};
export type SearchFilesToolParams = {
    name: "search_files";
    input: z.infer<typeof schema>;
};
export {};
