import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for file_changes_plan tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    path: z.string().describe("The path of the file you want to change."),
    what_to_accomplish: z.string().describe("What you want to accomplish with this file change."),
})

/**
 * Type definitions derived from schema
 */
export type FileChangePlanInput = z.infer<typeof schema>

export type FileChangePlanToolParams = {
    name: "file_changes_plan"
    input: FileChangePlanInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { 
        path: "/src",
        what_to_accomplish: "Implement a new authentication flow for user login"
    },
    { 
        path: "/lib",
        what_to_accomplish: "Refactor utility functions to improve performance"
    },
    { 
        path: "/components",
        what_to_accomplish: "Add responsive design to UI components"
    }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("file_changes_plan", exampleParams)

/**
 * Prompt definition for LLM consumption
 */
export const promptDefinition = {
    name: "file_changes_plan",
    description: "Create a plan for changing a file or directory. This tool helps with planning modifications by documenting what needs to be accomplished.",
    parameters: {
        path: {
            type: "string",
            description: "The path of the file or directory you want to change.",
            required: true,
        },
        what_to_accomplish: {
            type: "string",
            description: "What you want to accomplish with this file change.",
            required: true,
        },
    },
    capabilities: [
        "You can use file_changes_plan to document what changes you intend to make to a file or directory.",
        "This tool helps with organized planning before making code modifications.",
        "Clearly articulate what you want to accomplish with the changes."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Plan changes for ${exampleParams[i].path}`,
        output: call
    })),
    ...defineToolCallFormat("file_changes_plan")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const fileChangePlanTool = {
    name: "file_changes_plan",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}