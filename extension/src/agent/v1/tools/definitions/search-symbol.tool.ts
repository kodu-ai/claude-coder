import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for search_symbol tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    symbolName: z.string().describe("The name of the symbol to search for (e.g., function name, class name)"),
    path: z.string().describe("The path to search in (relative to the current working directory)"),
})

/**
 * Type definitions derived from schema
 */
export type SearchSymbolInput = z.infer<typeof schema>

export type SearchSymbolToolParams = {
    name: "search_symbol"
    input: SearchSymbolInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { symbolName: "handleRequest", path: "src" },
    { symbolName: "UserService", path: "src/services" },
    { symbolName: "processData", path: "lib/utils" }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("search_symbol", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/search-symbol.ts but with unified calling format
 */
export const promptDefinition = {
    name: "search_symbol",
    description: "Request to find and understand code symbol (function, classe, method) in source files. This tool helps navigate and understand code structure by finding symbol definitions and their context. It's particularly useful for:\n- Understanding function implementations\n- Finding class definitions\n- Tracing method usage\n- Building mental models of code",
    parameters: {
        symbolName: {
            type: "string",
            description: "The name of the symbol to search for (e.g., function name, class name)",
            required: true,
        },
        path: {
            type: "string",
            description: "The path to search in (relative to the current working directory)",
            required: true,
        },
    },
    capabilities: [
        "You can use search_symbol tool to understand how a specific function, class, or method is implemented in the codebase it can help you map potential changes, relationships, and dependencies between different parts of the codebase."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Search for symbol '${exampleParams[i].symbolName}' in ${exampleParams[i].path}`,
        output: call
    })),
    ...defineToolCallFormat("search_symbol")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const searchSymbolTool = {
    name: "search_symbol",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}