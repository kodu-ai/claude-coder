import { z } from "zod";
declare const schema: z.ZodObject<{
    review: z.ZodString;
}, "strip", z.ZodTypeAny, {
    review: string;
}, {
    review: string;
}>;
export type SubmitReviewToolParams = {
    name: "submit_review";
    input: z.infer<typeof schema>;
};
export declare const submitReviewTool: {
    schema: {
        name: "submit_review";
        schema: z.ZodObject<{
            review: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            review: string;
        }, {
            review: string;
        }>;
    };
    examples: string[];
};
export {};
