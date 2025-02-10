import { z } from "zod";
/**
 * @tool read_file
 * @description Read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file, for example to analyze code, review text files, or extract information from configuration files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.
 * @schema
 * {
 *   path: string; // The path of the file to read.
 * }
 * @example
 * ```xml
 * <tool name="read_file">
 *   <path>/config/settings.json</path>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="read_file">
 *   <path>/documents/report.docx</path>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="read_file">
 *   <path>/src/index.js</path>
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
export declare const readFileTool: {
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
export type ReadFileToolParams = {
    name: "read_file";
    input: z.infer<typeof schema>;
};
export {};
