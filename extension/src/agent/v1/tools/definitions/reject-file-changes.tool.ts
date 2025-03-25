import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for reject_file_changes tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    reason: z.string().describe("The reason for rejecting the file changes."),
})

/**
 * Type definitions derived from schema
 */
export type RejectFileChangesInput = z.infer<typeof schema>

export type RejectFileChangesToolParams = {
    name: "reject_file_changes"
    input: RejectFileChangesInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { 
        reason: "The proposed changes would break existing functionality in the authentication system."
    },
    { 
        reason: "The code style doesn't match the project's coding standards."
    },
    { 
        reason: "The implementation doesn't handle edge cases properly."
    }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("reject_file_changes", exampleParams)

/**
 * Prompt definition for LLM consumption
 */
export const promptDefinition = {
    name: "reject_file_changes",
    description: "Reject proposed file changes and provide a reason for the rejection. This tool helps with quality control by documenting why changes were not accepted.",
    parameters: {
        reason: {
            type: "string",
            description: "The reason for rejecting the file changes.",
            required: true,
        },
    },
    capabilities: [
        "You can use reject_file_changes to document why proposed changes to files are not acceptable.",
        "Provide a clear explanation for why the changes are being rejected.",
        "This helps maintain code quality by documenting rejection reasons."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: "Reject file changes",
        output: call
    })),
    ...defineToolCallFormat("reject_file_changes")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const rejectFileChangesTool = {
    name: "reject_file_changes",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}