import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for ask_followup_question tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    question: z
        .string()
        .describe(
            "The question to ask the user. This should be a clear, specific question that addresses the information you need."
        ),
})

/**
 * Type definitions derived from schema
 */
export type AskFollowupQuestionInput = z.infer<typeof schema>

export type AskFollowupQuestionToolParams = {
    name: "ask_followup_question"
    input: AskFollowupQuestionInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { question: "Could you please provide more details about the desired functionality?" },
    { question: "What is the deadline for this task?" },
    { question: "Do you have any preferred programming languages for this project?" }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("ask_followup_question", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/ask-followup-question.ts but with unified calling format
 */
export const promptDefinition = {
    name: "ask_followup_question",
    description: "Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively. It allows for interactive problem-solving by enabling direct communication with the user. Use this tool judiciously to maintain a balance between gathering necessary information and avoiding excessive back-and-forth.",
    parameters: {
        question: {
            type: "string",
            description: "The question to ask the user. This should be a clear, specific question that addresses the information you need.",
            required: true,
        },
    },
    capabilities: [
        "You can use ask_followup_question tool to ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively, this is meant to enable direct communication with the user but should be used only when absolutely necessary or when the user directly asks for it."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Ask: ${exampleParams[i].question}`,
        output: call
    })),
    ...defineToolCallFormat("ask_followup_question")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const askFollowupQuestionTool = {
    name: "ask_followup_question",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}