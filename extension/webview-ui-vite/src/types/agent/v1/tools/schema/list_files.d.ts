import { z } from "zod";
/**
 * @tool list_files
 * @description List files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents.
 * @schema
 * {
 *   path: string;       // The path of the directory to list contents for.
 *   recursive?: string; // Optional. Use 'true' for recursive listing.
 * }
 * @example
 * ```xml
 * <tool name="list_files">
 *   <path>/documents</path>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="list_files">
 *   <path>/projects</path>
 *   <recursive>true</recursive>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="list_files">
 *   <path>.</path>
 * </tool>
 * ```
 */
declare const schema: z.ZodObject<{
    path: z.ZodString;
    recursive: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    recursive?: "true" | "false" | undefined;
}, {
    path: string;
    recursive?: "true" | "false" | undefined;
}>;
export declare const listFilesTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            path: z.ZodString;
            recursive: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            recursive?: "true" | "false" | undefined;
        }, {
            path: string;
            recursive?: "true" | "false" | undefined;
        }>;
    };
    examples: string[];
};
export type ListFilesToolParams = {
    name: "list_files";
    input: z.infer<typeof schema>;
};
export {};
