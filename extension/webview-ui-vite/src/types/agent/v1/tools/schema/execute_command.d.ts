import { z } from "zod";
/**
 * @tool execute_command
 * @description Execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will be executed in the current working directory.
 * @schema
 * {
 *   command: string; // The CLI command to execute.
 * }
 * @example
 * ```xml
 * <tool name="execute_command">
 *   <command>ls -la</command>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="execute_command">
 *   <command>mkdir new_folder && cd new_folder</command>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="execute_command">
 *   <command>echo 'Hello World' > hello.txt</command>
 * </tool>
 * ```
 */
declare const schema: z.ZodObject<{
    command: z.ZodString;
}, "strip", z.ZodTypeAny, {
    command: string;
}, {
    command: string;
}>;
export declare const executeCommandTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            command: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            command: string;
        }, {
            command: string;
        }>;
    };
    examples: string[];
};
export type ExecuteCommandToolParams = {
    name: "execute_command";
    input: z.infer<typeof schema>;
};
export {};
