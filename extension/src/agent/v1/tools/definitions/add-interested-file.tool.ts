import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for add_interested_file tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    path: z.string().describe("The path of the file to track (relative to the current working directory)"),
    why: z.string().describe("Explanation of why this file is relevant to the current task"),
})

/**
 * Type definitions derived from schema
 */
export type AddInterestedFileInput = z.infer<typeof schema>

export type AddInterestedFileToolParams = {
    name: "add_interested_file"
    input: AddInterestedFileInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { 
        path: "/src/services/auth.ts",
        why: "Contains authentication logic that needs to be modified for the new feature"
    },
    { 
        path: "/src/types/user.ts",
        why: "Defines user interface that will be extended with new properties"
    },
    { 
        path: "/src/utils/validation.ts",
        why: "Contains validation helpers that will be reused in the new feature"
    }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("add_interested_file", exampleParams)

/**
 * Prompt definition for LLM consumption
 */
export const promptDefinition = {
    name: "add_interested_file",
    description: "Track files that are relevant to the current task. This tool helps maintain context by tracking file dependencies and documenting why files are important.",
    parameters: {
        path: {
            type: "string",
            description: "The path of the file to track (relative to the current working directory)",
            required: true,
        },
        why: {
            type: "string",
            description: "Explanation of why this file is relevant to the current task",
            required: true,
        },
    },
    capabilities: [
        "You can use add_interested_file tool to mark files as important for the current task.",
        "This helps maintain context by documenting why certain files are relevant.",
        "Always provide a clear explanation of why the file is important to the task."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Track ${exampleParams[i].path} as important`,
        output: call
    })),
    ...defineToolCallFormat("add_interested_file")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const addInterestedFileTool = {
    name: "add_interested_file",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}