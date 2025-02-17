import { z } from "zod";
/**
 * @tool explore_repo_folder
 * @description Lists definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.
 * @schema
 * {
 *   path: string; // The path of the directory to list code definitions for.
 * }
 * @example
 * ```xml
 * <tool name="explore_repo_folder">
 *   <path>/src</path>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="explore_repo_folder">
 *   <path>/lib</path>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="explore_repo_folder">
 *   <path>/components</path>
 * </tool>
 * ```
 */
declare const schema: z.ZodObject<{
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
}, {
    path: string;
}>;
export declare const ExploreRepoFolderTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            path: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
        }, {
            path: string;
        }>;
    };
    examples: string[];
};
export type ExploreRepoFolderToolParams = {
    name: "explore_repo_folder";
    input: z.infer<typeof schema>;
};
export {};
