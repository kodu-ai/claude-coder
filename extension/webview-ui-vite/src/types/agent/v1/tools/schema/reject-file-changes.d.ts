import { z } from "zod";
declare const schema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const rejectFileChangesTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            reason: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            reason: string;
        }, {
            reason: string;
        }>;
    };
    examples: string[];
};
export type RejectFileChangesParams = {
    name: "reject_file_changes";
    input: z.infer<typeof schema>;
};
export {};
