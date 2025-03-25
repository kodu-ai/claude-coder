import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for exit_agent tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    result: z.string().describe("The result of the sub-agent operation"),
})

/**
 * Type definitions derived from schema
 */
export type ExitAgentInput = z.infer<typeof schema>

export type ExitAgentToolParams = {
    name: "exit_agent"
    input: ExitAgentInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { 
        result: `I've installed the following dependencies:
- Jest
- Enzyme
- Axios
- React Testing Library

Here is the unit test output:
Test Suites: 3 passed,1 failed, 4 total
PASS src/components/App.test.js
PASS src/components/Header.test.js
PASS src/components/Footer.test.js
FAIL src/components/Profile.test.js - Expected 1, received 0 (I think this is related to the API call)`
    }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("exit_agent", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/exit-agent.ts but with unified calling format
 */
export const promptDefinition = {
    name: "exit_agent",
    description: "Exit the current task and return the final result of the task, the result must be detailed and to the point, this result will be passed back to the user for further processing or task completion.",
    parameters: {
        result: {
            type: "string",
            description: "The final result or output of the agent operation. This should be a string describing what was accomplished or any relevant output that should be passed back to the user.",
            required: true,
        },
    },
    capabilities: [
        "Once you finish and finalized the task, you can use exit_agent tool to exit the current task and return the final result of the task, the result must be detailed and to the point, this result will be passed back to the user for further processing or task completion, this tool is used to let the user know that the task is completed and the final result is ready for review."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Exit agent with results from task completion`,
        output: call
    })),
    ...defineToolCallFormat("exit_agent")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const exitAgentTool = {
    name: "exit_agent",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}