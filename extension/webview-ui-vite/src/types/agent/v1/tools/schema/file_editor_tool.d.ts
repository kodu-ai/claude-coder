import { z } from "zod";
export declare const FileEditorModes: readonly ["edit", "whole_write", "rollback"];
declare const schema: z.ZodObject<{
    path: z.ZodString;
    mode: z.ZodEffects<z.ZodEnum<["edit", "whole_write", "rollback"]>, "edit" | "whole_write" | "rollback", unknown>;
    commit_message: z.ZodOptional<z.ZodString>;
    kodu_content: z.ZodOptional<z.ZodString>;
    kodu_diff: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    mode: "edit" | "whole_write" | "rollback";
    kodu_diff?: string | undefined;
    kodu_content?: string | undefined;
    commit_message?: string | undefined;
}, {
    path: string;
    kodu_diff?: string | undefined;
    kodu_content?: string | undefined;
    mode?: unknown;
    commit_message?: string | undefined;
}>;
export declare const fileEditorTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            path: z.ZodString;
            mode: z.ZodEffects<z.ZodEnum<["edit", "whole_write", "rollback"]>, "edit" | "whole_write" | "rollback", unknown>;
            commit_message: z.ZodOptional<z.ZodString>;
            kodu_content: z.ZodOptional<z.ZodString>;
            kodu_diff: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            mode: "edit" | "whole_write" | "rollback";
            kodu_diff?: string | undefined;
            kodu_content?: string | undefined;
            commit_message?: string | undefined;
        }, {
            path: string;
            kodu_diff?: string | undefined;
            kodu_content?: string | undefined;
            mode?: unknown;
            commit_message?: string | undefined;
        }>;
    };
    examples: string[];
};
export type FileEditorToolParams = {
    name: "file_editor";
    input: z.infer<typeof schema>;
};
export {};
