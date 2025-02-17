import { z } from "zod";
/**
 * @tool dev_server
 * @description Manage a development server by starting, stopping, restarting, or retrieving logs. This tool allows for flexible control over the development environment.
 * @schema
 * {
 *   commandType: "start" | "stop" | "restart" | "getLogs";  // The type of operation to perform on the dev server.
 *   commandToRun: string;                                   // The specific command to execute for the operation.
 * }
 * @example
 * ```xml
 * <tool name="dev_server">
 *   <commandType>start</commandType>
 *   <commandToRun>npm run dev</commandToRun>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="dev_server">
 *   <commandType>stop</commandType>
 *   <commandToRun>npm run stop</commandToRun>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="dev_server">
 *   <commandType>restart</commandType>
 *   <commandToRun>npm run dev</commandToRun>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="dev_server">
 *   <commandType>getLogs</commandType>
 *   <commandToRun></commandToRun>
 * </tool>
 * ```
 */
declare const schema: z.ZodObject<{
    commandType: z.ZodOptional<z.ZodEnum<["start", "stop", "restart", "getLogs"]>>;
    serverName: z.ZodOptional<z.ZodString>;
    commandToRun: z.ZodOptional<z.ZodString>;
    lines: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    commandToRun?: string | undefined;
    commandType?: "start" | "stop" | "restart" | "getLogs" | undefined;
    serverName?: string | undefined;
    lines?: string | undefined;
}, {
    commandToRun?: string | undefined;
    commandType?: "start" | "stop" | "restart" | "getLogs" | undefined;
    serverName?: string | undefined;
    lines?: string | undefined;
}>;
export declare const devServerTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            commandType: z.ZodOptional<z.ZodEnum<["start", "stop", "restart", "getLogs"]>>;
            serverName: z.ZodOptional<z.ZodString>;
            commandToRun: z.ZodOptional<z.ZodString>;
            lines: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            commandToRun?: string | undefined;
            commandType?: "start" | "stop" | "restart" | "getLogs" | undefined;
            serverName?: string | undefined;
            lines?: string | undefined;
        }, {
            commandToRun?: string | undefined;
            commandType?: "start" | "stop" | "restart" | "getLogs" | undefined;
            serverName?: string | undefined;
            lines?: string | undefined;
        }>;
    };
    examples: string[];
};
export type ServerRunnerToolParams = {
    name: "server_runner";
    input: z.infer<typeof schema>;
};
export {};
