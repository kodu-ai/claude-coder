import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for read_file tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    path: z.string().describe("The path of the file to read (relative to the current working directory)."),
})

/**
 * Type definitions derived from schema
 */
export type ReadFileInput = z.infer<typeof schema>

export type ReadFileToolParams = {
    name: "read_file"
    input: ReadFileInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { path: "/src/index.js" },
    { path: "/config/settings.json" },
    { path: "/documents/report.docx" }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("read_file", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/read-file.ts but with unified calling format
 */
export const promptDefinition = {
    name: "read_file",
    description: "Request to read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.",
    parameters: {
        path: {
            type: "string",
            description: "The path of the file to read (relative to the current working directory)",
            required: true,
        },
    },
    capabilities: [
        "You can use read_file tool to read the contents of a file at the specified path and time, this tool is useful when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files.",
        "When you use read_file tool, it will automatically extracts raw text from PDF and DOCX files, but may not be suitable for other types of binary files, as it returns the raw content as a string.",
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Read ${exampleParams[i].path}`,
        output: call
    })),
    ...defineToolCallFormat("read_file")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const readFileTool = {
    name: "read_file",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}