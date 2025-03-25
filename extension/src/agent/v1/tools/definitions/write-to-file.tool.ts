import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for write_to_file tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    path: z.string().describe("The path of the file to write to (relative to the current working directory)."),
    kodu_content: z
        .string()
        .describe(
            "The full content to write to the file when creating a new file. Always provide the complete content without any truncation."
        )
        .optional(),
    kodu_diff: z
        .string()
        .describe(
            "The `SEARCH/REPLACE` blocks representing the changes to be made to an existing file. These blocks must be formatted correctly, matching exact existing content for `SEARCH` and precise modifications for `REPLACE`."
        )
        .optional(),
})

/**
 * Type definitions derived from schema
 */
export type WriteToFileInput = z.infer<typeof schema>

export type WriteToFileToolParams = {
    name: "write_to_file"
    input: WriteToFileInput
}

export type EditFileBlocksToolParams = {
    name: "edit_file_blocks"
    input: WriteToFileInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { 
        path: "/scripts/setup.sh",
        kodu_content: "\n<diff>\nSEARCH\necho \"Setting up environment\"\n=======\nREPLACE\necho \"Initializing environment\"\n</diff>"
    },
    { 
        path: "/hello.py",
        content: "def hello():\n    \"print a greeting\"\n\n    print(\"hello\")"
    }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("write_to_file", exampleParams)

/**
 * Prompt definition for LLM consumption
 */
export const promptDefinition = {
    name: "write_to_file",
    description: "Write content to a file at the specified path. This tool has two modes of operation: 1) Creating a New File: Provide the full intended content using the `content` parameter. The file will be created if it does not exist. 2) Modifying an Existing File: Provide changes using `SEARCH/REPLACE` blocks to precisely describe modifications to existing files. If the file exists, use the `diff` parameter to describe the changes. If the file doesn't exist, use the `content` parameter to create it with the provided content. Always provide the full content or accurate changes using `SEARCH/REPLACE` blocks. Never truncate content or use placeholders.",
    parameters: {
        path: {
            type: "string",
            description: "The path of the file to write to (relative to the current working directory).",
            required: true,
        },
        kodu_content: {
            type: "string",
            description: "The full content to write to the file when creating a new file. Always provide the complete content without any truncation.",
            required: false,
        },
        kodu_diff: {
            type: "string",
            description: "The `SEARCH/REPLACE` blocks representing the changes to be made to an existing file. These blocks must be formatted correctly, matching exact existing content for `SEARCH` and precise modifications for `REPLACE`.",
            required: false,
        },
    },
    capabilities: [
        "You can use write_to_file tool to create new files with specific content.",
        "You can modify existing files by providing precise SEARCH/REPLACE blocks that identify the exact content to change.",
        "When creating a new file, always provide the complete content without truncation.",
        "When modifying an existing file, format your SEARCH/REPLACE blocks correctly, matching existing content exactly."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: i === 0 ? `Modify ${exampleParams[i].path}` : `Create ${exampleParams[i].path}`,
        output: call
    })),
    ...defineToolCallFormat("write_to_file")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const writeToFileTool = {
    name: "write_to_file",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}