import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for list_files tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    path: z
        .string()
        .describe("The path of the directory to list contents for (relative to the current working directory)."),
    recursive: z
        .enum(["true", "false"])
        .optional()
        .describe(
            "Whether to list files recursively. Use 'true' for recursive listing, 'false' or omit for top-level only."
        ),
})

/**
 * Type definitions derived from schema
 */
export type ListFilesInput = z.infer<typeof schema>

export type ListFilesToolParams = {
    name: "list_files"
    input: ListFilesInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { path: "/documents" },
    { path: "/projects", recursive: "true" },
    { path: "." }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("list_files", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/list-files.ts but with unified calling format
 */
export const promptDefinition = {
    name: "list_files",
    description: "Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. Do not use this tool to confirm the existence of files you may have created, as the user will let you know if the files were created successfully or not.",
    parameters: {
        path: {
            type: "string",
            description: "The path of the directory to list contents for (relative to the current working directory)",
            required: true,
        },
        recursive: {
            type: "string",
            description: "Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.",
            required: false,
        },
    },
    capabilities: [
        "You can use list_files tool to list files and directories within the specified directory. This tool is useful for understanding the contents of a directory, verifying the presence of files, or identifying the structure of a project."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `List files in ${exampleParams[i].path}${exampleParams[i].recursive ? ' recursively' : ''}`,
        output: call
    })),
    ...defineToolCallFormat("list_files")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const listFilesTool = {
    name: "list_files",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}