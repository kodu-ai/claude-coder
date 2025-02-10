import { z } from "zod";
declare const schema: z.ZodObject<{
    path: z.ZodString;
    what_to_accomplish: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    what_to_accomplish: string;
}, {
    path: string;
    what_to_accomplish: string;
}>;
export declare const fileChangePlanTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            path: z.ZodString;
            what_to_accomplish: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            what_to_accomplish: string;
        }, {
            path: string;
            what_to_accomplish: string;
        }>;
    };
    examples: string[];
};
export type FileChangePlanParams = {
    name: "file_changes_plan";
    input: z.infer<typeof schema>;
};
export {};
