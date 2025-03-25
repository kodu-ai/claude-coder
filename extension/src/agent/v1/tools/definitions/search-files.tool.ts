import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for search_files tool
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
            "The path of the directory to search in (relative to the current working directory). This directory will be recursively searched."
        ),
    regex: z.string().describe("The regular expression pattern to search for. Uses Rust regex syntax."),
    filePattern: z
        .string()
        .optional()
        .describe(
            "Optional glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*)."
        ),
})

/**
 * Type definitions derived from schema
 */
export type SearchFilesInput = z.infer<typeof schema>

export type SearchFilesToolParams = {
    name: "search_files"
    input: SearchFilesInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { path: "/logs", regex: "Error.*" },
    { path: "/src", regex: "function\\s+\\w+", filePattern: "*.js" },
    { path: "/documents", regex: "TODO" }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("search_files", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/search-files.ts but with unified calling format
 */
export const promptDefinition = {
    name: "search_files",
    description: "Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.",
    parameters: {
        path: {
            type: "string",
            description: "The path of the directory to search in (relative to the current working directory). This directory will be recursively searched.",
            required: true,
        },
        regex: {
            type: "string",
            description: "The regular expression pattern to search for. Uses Rust regex syntax.",
            required: true,
        },
        filePattern: {
            type: "string",
            description: "Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).",
            required: false,
        },
    },
    capabilities: [
        "You can use search_files tool to perform regex searches across files in a specified directory, outputting context-rich results that include surrounding lines. This is particularly useful for understanding code patterns, finding specific implementations, or identifying areas that need refactoring."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Search for ${exampleParams[i].regex} in ${exampleParams[i].path}`,
        output: call
    })),
    ...defineToolCallFormat("search_files")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const searchFilesTool = {
    name: "search_files",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}