import { z } from "zod";
declare const schema: z.ZodObject<{
    result: z.ZodString;
}, "strip", z.ZodTypeAny, {
    result: string;
}, {
    result: string;
}>;
export declare const exitAgentTool: {
    schema: {
        name: "exit_agent";
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
export type ExitAgentToolParams = {
    name: typeof exitAgentTool.schema.name;
    input: z.infer<typeof schema>;
};
export {};
