import { z } from "zod";
/**
 * @tool write_to_file
 * @description Write content to a file at the specified path. This tool has two modes of operation:
 * 1. **Creating a New File**: Provide the full intended content using the `content` parameter. The file will be created if it does not exist.
 * 2. **Modifying an Existing File**: Provide changes using `SEARCH/REPLACE` blocks to precisely describe modifications to existing files.
 * If the file exists, use the `diff` parameter to describe the changes. If the file doesn't exist, use the `content` parameter to create it with the provided content.
 * Always provide the full content or accurate changes using `SEARCH/REPLACE` blocks. Never truncate content or use placeholders.
 * @schema
 * {
 *   path: string;     // The path of the file to write to.
 *   content?: string; // The complete content to write to the file when creating a new file.
 *   diff?: string;    // The `SEARCH/REPLACE` blocks representing changes to be made to an existing file.
 * }
 * @example (Creating a new file)
 * ```xml
 * <tool name="write_to_file">
 *   <path>/notes/todo.txt</path>
 *   <content>Buy groceries\nCall Alice</content>
 * </tool>
 * ```
 * @example (Modifying an existing file)
 * ```xml
 * <tool name="write_to_file">
 *   <path>/scripts/setup.sh</path>
 * <kodu_content>
 * <diff>
 * <scripts/setup.sh
 * <<<<<<< SEARCH
 * echo "Setting up environment"
 * =======
 * echo "Initializing environment"
 * >>>>>>> REPLACE
 * </diff>
 * </kodu_content>
 * </tool>
 * ```
 */
declare const schema: z.ZodObject<{
    path: z.ZodString;
    kodu_content: z.ZodOptional<z.ZodString>;
    kodu_diff: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    kodu_diff?: string | undefined;
    kodu_content?: string | undefined;
}, {
    path: string;
    kodu_diff?: string | undefined;
    kodu_content?: string | undefined;
}>;
export declare const writeToFileTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            path: z.ZodString;
            kodu_content: z.ZodOptional<z.ZodString>;
            kodu_diff: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            kodu_diff?: string | undefined;
            kodu_content?: string | undefined;
        }, {
            path: string;
            kodu_diff?: string | undefined;
            kodu_content?: string | undefined;
        }>;
    };
    examples: string[];
};
export type WriteToFileToolParams = {
    name: "write_to_file";
    input: z.infer<typeof schema>;
};
export type EditFileBlocksToolParams = {
    name: "edit_file_blocks";
    input: z.infer<typeof schema>;
};
export {};
