import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for execute_command tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    command: z
        .string()
        .describe(
            "The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions."
        ),
})

/**
 * Type definitions derived from schema
 */
export type ExecuteCommandInput = z.infer<typeof schema>

export type ExecuteCommandToolParams = {
    name: "execute_command"
    input: ExecuteCommandInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { command: "ls -la" },
    { command: "mkdir new_folder && cd new_folder" },
    { command: "echo 'Hello World' > hello.txt" },
    { command: "npm install express" }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("execute_command", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/execute-command.ts but with unified calling format
 */
export const promptDefinition = {
    name: "execute_command",
    description: "Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will be executed in the current working directory.",
    parameters: {
        command: {
            type: "string",
            description: "The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.\nCOMMAND CANNOT RUN SOMETHING like 'npm start', 'yarn start', 'python -m http.server', etc. (if you want to start a server, you must use the server_runner tool.)",
            required: true,
        },
    },
    capabilities: [
        "You can use execute_command tool to execute a CLI command on the system, this tool is useful when you need to perform system operations or run specific commands to accomplish any step in the user's task, you must tailor your command to the user's system and provide a clear explanation of what the command does, prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. for example, you can use this tool to install a package using npm, run a build command, etc or for example remove a file, create a directory, copy a file, etc."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Execute: ${exampleParams[i].command}`,
        output: call
    })),
    ...defineToolCallFormat("execute_command")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const executeCommandTool = {
    name: "execute_command",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}