import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for web_search tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    searchQuery: z.string().describe("The question you want to search for on the web."),
    baseLink: z
        .string()
        .optional()
        .describe("The base link provided by the user. If it is provided, you can start your search from here."),
    browserModel: z
        .enum(["smart", "fast"])
        .default("fast")
        .optional()
        .describe(
            "The browser model to use for the search. Use 'smart' for slower but smarter search, use 'fast' for faster but less smart search."
        ),
    browserMode: z
        .enum(["api_docs", "generic"])
        .default("generic")
        .optional()
        .describe(
            "The browser mode to use for the search. Use 'generic' to search the web. Use 'api_docs' when you want to search API docs."
        ),
})

/**
 * Type definitions derived from schema
 */
export type WebSearchInput = z.infer<typeof schema>

export type WebSearchToolParams = {
    name: "web_search"
    input: WebSearchInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { 
        searchQuery: "Latest advancements in AI technology",
        browserModel: "smart",
        browserMode: "generic"
    },
    { 
        searchQuery: "How to optimize React applications?",
        baseLink: "https://reactjs.org/docs/optimizing-performance.html",
        browserModel: "smart",
        browserMode: "generic"
    },
    { 
        searchQuery: "Zustand state management API setter function",
        browserMode: "api_docs"
    },
    { 
        searchQuery: "Fixing type error in my code",
        browserModel: "fast"
    }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("web_search", exampleParams)

/**
 * Prompt definition for LLM consumption
 */
export const promptDefinition = {
    name: "web_search",
    description: "Lets you ask a question about links and generate a short summary of information regarding a question. You can provide a link to access directly or a search query. At both stages, you are required to provide a general question about this web search.",
    parameters: {
        searchQuery: {
            type: "string",
            description: "The question you want to search for on the web.",
            required: true,
        },
        baseLink: {
            type: "string",
            description: "Optional base link provided by the user.",
            required: false,
        },
        browserModel: {
            type: "string",
            description: "The browser model to use for the search. Use 'smart' for slower but smarter search, use 'fast' for faster but less smart search.",
            required: false,
            enum: ["smart", "fast"],
            default: "fast"
        },
        browserMode: {
            type: "string",
            description: "The browser mode to use for the search. Use 'generic' to search the web. Use 'api_docs' when you want to search API docs.",
            required: false,
            enum: ["api_docs", "generic"],
            default: "generic"
        },
    },
    capabilities: [
        "You can use the web_search tool to search the web for information about a specific topic or question.",
        "You can optionally provide a base link to start your search from a specific page.",
        "You can specify the browser model (smart/fast) and mode (api_docs/generic) for different search scenarios."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Search for ${exampleParams[i].searchQuery}`,
        output: call
    })),
    ...defineToolCallFormat("web_search")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const webSearchTool = {
    name: "web_search",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}