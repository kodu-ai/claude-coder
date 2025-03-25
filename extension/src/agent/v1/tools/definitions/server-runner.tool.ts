import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for server_runner tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    commandType: z
        .enum(["start", "stop", "restart", "getLogs"])
        .optional()
        .describe(
            "The type of operation to perform on the dev server. 'start' begins the server, 'stop' terminates it, 'restart' stops then starts the server, and 'getLogs' retrieves the server logs."
        ),
    serverName: z.string().optional().describe("The name of the terminal to use for the operation."),
    commandToRun: z
        .string()
        .optional()
        .describe(
            "The specific command to execute for the operation. For 'start' and 'restart', this is typically the command to start your dev server (e.g., 'npm run dev'). For 'stop', it's the command to stop the server. For 'getLogs', this can be left empty."
        ),
    lines: z.string().default("-1").optional().describe("The number of lines to retrieve from the logs."),
})

/**
 * Type definitions derived from schema
 */
export type ServerRunnerInput = z.infer<typeof schema>

export type ServerRunnerToolParams = {
    name: "server_runner"
    input: ServerRunnerInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { 
        commandType: "start", 
        commandToRun: "cd frontend && npm run dev", 
        serverName: "frontend" 
    },
    { 
        commandType: "getLogs", 
        serverName: "frontend", 
        lines: "50" 
    },
    { 
        commandType: "restart", 
        commandToRun: "npm run dev", 
        serverName: "backend" 
    },
    { 
        commandType: "stop", 
        serverName: "frontend" 
    }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("server_runner", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/server-runner.ts but with unified calling format
 */
export const promptDefinition = {
    name: "server_runner",
    description: "start a server / development server. This tool is used to run web applications locally, backend server, or anytype of server. this is tool allow you to start, stop, restart, or get logs from a server instance and keep it in memory.\nTHIS IS THE ONLY TOOL THAT IS CAPABLE OF STARTING A SERVER, DO NOT USE THE execute_command TOOL TO START A SERVER, I REPEAT, DO NOT USE THE execute_command TOOL TO START A SERVER.\nYOU MUST GIVE A NAME FOR EACH SERVER INSTANCE YOU START, SO YOU CAN KEEP TRACK OF THEM.\nYou must always provide all the parameters for this tool.",
    parameters: {
        commandToRun: {
            type: "string",
            description: "The CLI command to start the server. This should be valid for the current operating system. Ensure the command is properly formatted and has the correct path to the directory you want to serve (relative to the current working directory).",
            required: false,
        },
        commandType: {
            type: "string",
            description: "The type of command to run. Use 'start' to start the server, 'stop' to stop it, 'restart' to restart it, or 'getLogs' to retrieve logs from the server.",
            required: true,
        },
        serverName: {
            type: "string",
            description: "The name of the terminal to use for the operation. This is used to identify the terminal instance where the server is running.",
            required: true,
        },
        lines: {
            type: "string",
            description: "The number of lines to retrieve from the server logs. This is only required when the commandType is 'getLogs'.",
            required: "Required when commandType is 'getLogs'",
        },
    },
    capabilities: [
        "You can use server_runner tool to start, stop, restart, or get logs from a server instance while keeping it in memory for future use, it's extremely useful for running web applications locally, backend server, or any type of server instance."
    ],
    examples: exampleCalls.map((call, i) => {
        if (i === 0) {return { description: "Start a development server", output: call };}
        if (i === 1) {return { description: "Get logs from a server", output: call };}
        if (i === 2) {return { description: "Restart a server", output: call };}
        return { description: "Stop a server", output: call };
    }),
    ...defineToolCallFormat("server_runner")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const serverRunnerTool = {
    name: "server_runner",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}