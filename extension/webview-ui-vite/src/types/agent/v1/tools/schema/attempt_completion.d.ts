import { z } from "zod";
/**
 * @tool attempt_completion
 * @description Once you've completed the task, use this tool to present the result to the user. They may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.
 * @schema
 * {
 *   result: string;        // The result of the task.
 *   command?: string;      // Optional CLI command to show a live demo.
 * }
 * @example
 * ```xml
 * <tool name="attempt_completion">
 *   <result>The requested feature has been implemented successfully.</result>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="attempt_completion">
 *   <result>The website is ready for review.</result>
 *   <command>open index.html</command>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="attempt_completion">
 *   <result>The data analysis is complete. Please find the report attached.</result>
 * </tool>
 * ```
 */
declare const schema: z.ZodObject<{
    result: z.ZodString;
}, "strip", z.ZodTypeAny, {
    result: string;
}, {
    result: string;
}>;
export declare const attemptCompletionTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            result: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            result: string;
        }, {
            result: string;
        }>;
    };
    examples: string[];
};
export type AttemptCompletionToolParams = {
    name: "attempt_completion";
    input: z.infer<typeof schema>;
};
export {};
