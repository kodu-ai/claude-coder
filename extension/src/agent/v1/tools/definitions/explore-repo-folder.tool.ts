import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for explore_repo_folder tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    path: z
        .string()
        .describe(
            "The path of the directory (relative to the current working directory) to list top-level source code definitions for."
        ),
})

/**
 * Type definitions derived from schema
 */
export type ExploreRepoFolderInput = z.infer<typeof schema>

export type ExploreRepoFolderToolParams = {
    name: "explore_repo_folder"
    input: ExploreRepoFolderInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { path: "/src" },
    { path: "/lib" },
    { path: "/components" }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("explore_repo_folder", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/explore-repo-folder.ts but with unified calling format
 */
export const promptDefinition = {
    name: "explore_repo_folder",
    description: "Request to list definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.",
    parameters: {
        path: {
            type: "string",
            description: "The path of the directory (relative to the current working directory) to list top level source code definitions for.",
            required: true,
        },
    },
    capabilities: [
        "You can use explore_repo_folder tool to list definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Explore directory: ${exampleParams[i].path}`,
        output: call
    })),
    ...defineToolCallFormat("explore_repo_folder")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const exploreRepoFolderTool = {
    name: "explore_repo_folder",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}