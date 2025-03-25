import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for attempt_completion tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    result: z
        .string()
        .describe(
            "The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance."
        ),
    // Commented out as in original implementation
    // command: z
    //     .string()
    //     .optional()
    //     .describe(
    //         'The CLI command to execute to show a live demo of the result to the user. For example, use "open index.html" to display a created website. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.'
    //     ),
})

/**
 * Type definitions derived from schema
 */
export type AttemptCompletionInput = z.infer<typeof schema>

export type AttemptCompletionToolParams = {
    name: "attempt_completion"
    input: AttemptCompletionInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { result: "The requested feature has been implemented successfully." },
    { result: "The website is ready for review." },
    { result: "The data analysis is complete. Please find the report attached." }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("attempt_completion", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/attempt-complete.ts but with unified calling format
 */
export const promptDefinition = {
    name: "attempt_completion",
    description: "After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.",
    parameters: {
        result: {
            type: "string",
            description: "The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.",
            required: true,
        },
    },
    capabilities: [
        "You can use attempt_completion tool to present the result of your work to the user, this tool is used after you've received the results of tool uses and can confirm that the task is complete, the user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Complete task with result: ${exampleParams[i].result.substring(0, 30)}${exampleParams[i].result.length > 30 ? '...' : ''}`,
        output: call
    })),
    ...defineToolCallFormat("attempt_completion")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const attemptCompletionTool = {
    name: "attempt_completion",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}