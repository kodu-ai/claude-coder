import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for submit_review tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    review: z.string().describe("A formatted XML string containing the progress summary, questions, and next steps"),
})

/**
 * Type definitions derived from schema
 */
export type SubmitReviewInput = z.infer<typeof schema>

export type SubmitReviewToolParams = {
    name: "submit_review"
    input: SubmitReviewInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { 
        review: "<progress_summary>Implemented basic authentication flow with login/signup endpoints</progress_summary>\n<questions>\n- Should we add rate limiting to these endpoints?\n- Is the current token expiration time of 24h appropriate?\n</questions>\n<next_steps>Will implement password reset flow after review</next_steps>"
    },
    { 
        review: "<progress_summary>Created responsive UI components for the dashboard</progress_summary>\n<questions>\n- Is the current layout suitable for mobile devices?\n- Should we add more interactive elements?\n</questions>\n<next_steps>Will implement dark mode theme next</next_steps>"
    }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("submit_review", exampleParams)

/**
 * Prompt definition for LLM consumption
 */
export const promptDefinition = {
    name: "submit_review",
    description: "Submit a review of your progress on the current task. This includes a summary of what has been accomplished, questions that need answers, and planned next steps.",
    parameters: {
        review: {
            type: "string",
            description: "A formatted XML string containing the progress summary, questions, and next steps",
            required: true,
        },
    },
    capabilities: [
        "You can use submit_review to provide a structured update on your progress.",
        "Include what you've accomplished, questions you have, and what you plan to do next.",
        "Format your review with XML tags for progress_summary, questions, and next_steps."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: "Submit a progress review",
        output: call
    })),
    ...defineToolCallFormat("submit_review")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const submitReviewTool = {
    name: "submit_review",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}