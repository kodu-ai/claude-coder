import { z } from "zod";
export declare const SpawnAgentOptions: readonly ["coder", "planner", "sub_task"];
export type SpawnAgentOptions = (typeof SpawnAgentOptions)[number];
declare const schema: z.ZodObject<{
    agentName: z.ZodEnum<["coder", "planner", "sub_task"]>;
    instructions: z.ZodString;
    files: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    agentName: "coder" | "planner" | "sub_task";
    instructions: string;
    files?: string | undefined;
}, {
    agentName: "coder" | "planner" | "sub_task";
    instructions: string;
    files?: string | undefined;
}>;
export declare const spawnAgentTool: {
    schema: {
        name: "spawn_agent";
        schema: z.ZodObject<{
            agentName: z.ZodEnum<["coder", "planner", "sub_task"]>;
            instructions: z.ZodString;
            files: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            agentName: "coder" | "planner" | "sub_task";
            instructions: string;
            files?: string | undefined;
        }, {
            agentName: "coder" | "planner" | "sub_task";
            instructions: string;
            files?: string | undefined;
        }>;
    };
    examples: string[];
};
export type SpawnAgentToolParams = {
    name: typeof spawnAgentTool.schema.name;
    input: z.infer<typeof schema>;
};
export {};
