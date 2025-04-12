import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for spawn_agent tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * Agent type options
 */
export const SpawnAgentOptions = ["coder", "planner", "sub_task"] as const
export type SpawnAgentOptions = (typeof SpawnAgentOptions)[number]

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    agentName: z.enum(SpawnAgentOptions).describe("Name of the sub-agent for identification"),
    instructions: z.string().describe("Instructions for the sub-agent"),
    files: z.string().optional().describe("Files to be processed by the sub-agent"),
})

/**
 * Type definitions derived from schema
 */
export type SpawnAgentInput = z.infer<typeof schema>

export type SpawnAgentToolParams = {
    name: "spawn_agent"
    input: SpawnAgentInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { 
        agentName: "sub_task", 
        instructions: "Take a look at the project files and install the dependencies. Run the unit tests and report back the results with any failures.",
        files: "package.json,README.md"
    },
    { 
        agentName: "planner", 
        instructions: "Create a detailed plan for implementing a new user dashboard feature. Break down the requirements into manageable sub-tasks and identify dependencies."
    }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("spawn_agent", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/spawn-agent.ts but with unified calling format
 */
export const promptDefinition = {
    name: "spawn_agent",
    description: "Request to spawn a sub task agent with specific instructions and capabilities. This tool allows you to create specialized agents for specific sub tasks like planning, installing dependencies and running unit tests or even exploring the repo and reporting back. The tool requires user approval before creating the agent.",
    parameters: {
        agentName: {
            type: "string",
            description: "The type of agent to spawn. Must be one of: 'sub_task'. Each type is specialized for different tasks:\n- sub_task: For handling specific sub-components of a larger task",
            required: true,
        },
        instructions: {
            type: "string",
            description: "Detailed instructions for the sub-agent, describing its task and objectives, this is will be the meta prompt for the sub-agent. give few shots examples if possible",
            required: true,
        },
        files: {
            type: "string",
            description: "Comma-separated list of files that the sub-agent should focus on or work with. no spaces between files just comma separated values",
            required: false,
        },
    },
    capabilities: [
        "You can use spawn_agent tool to create specialized sub-agents for specific tasks like handling sub-tasks, each agent type has its own specialized capabilities and focus areas, the tool requires user approval before creating the agent and allows you to specify which files the agent should work with, ensuring proper context and state management throughout the agent's lifecycle.",
        "Spawnning a sub-agent is a great way to break down a large task into smaller, more manageable sub-tasks. This allows you to focus on one task at a time, ensuring that each sub-task is completed successfully before moving on to the next one.",
        "By creating specialized sub-agents, you can ensure that each agent is focused on a specific task or set of tasks, allowing for more efficient and effective task completion. This can help streamline your workflow and improve overall productivity."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: i === 0 ? "Spawn an agent to install the dependencies and run the unit tests" : "Spawn a planner agent to break down a task",
        output: call
    })),
    ...defineToolCallFormat("spawn_agent")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const spawnAgentTool = {
    name: "spawn_agent",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}