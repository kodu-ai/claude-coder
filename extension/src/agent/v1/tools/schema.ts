import { z } from "zod"
import { ToolSchema } from "./types"

export const reflectionTool: ToolSchema = {
    name: "reflection",
    schema: z.object({
        actions: z.array(z.object({
            toolName: z.string(),
            reasoning: z.string(),
            params: z.record(z.any()),
            outcome: z.any(),
            timestamp: z.number(),
            error: z.string().optional()
        })),
        focus: z.enum(['error-analysis', 'strategy-optimization', 'pattern-recognition']).optional(),
        limit: z.number().optional()
    })
}

// Export the reflection tool along with other tools
export const tools: ToolSchema[] = [
    {
        name: "read_file",
        schema: z.object({
            path: z.string()
        })
    },
    {
        name: "write_to_file",
        schema: z.object({
            path: z.string(),
            content: z.string()
        })
    },
    {
        name: "list_files",
        schema: z.object({
            path: z.string(),
            recursive: z.boolean().optional()
        })
    },
    {
        name: "search_files",
        schema: z.object({
            path: z.string(),
            regex: z.string(),
            file_pattern: z.string().optional()
        })
    },
    {
        name: "list_code_definition_names",
        schema: z.object({
            path: z.string()
        })
    },
    {
        name: "execute_command",
        schema: z.object({
            command: z.string()
        })
    },
    {
        name: "ask_followup_question",
        schema: z.object({
            question: z.string()
        })
    },
    {
        name: "attempt_completion",
        schema: z.object({
            result: z.string()
        })
    },
    {
        name: "web_search",
        schema: z.object({
            searchQuery: z.string(),
            browserMode: z.enum(["api_docs", "generic"]),
            baseLink: z.string().optional()
        })
    },
    {
        name: "url_screenshot",
        schema: z.object({
            url: z.string()
        })
    },
    {
        name: "ask_consultant",
        schema: z.object({
            query: z.string()
        })
    },
    {
        name: "server_runner_tool",
        schema: z.object({
            commandType: z.enum(["start", "stop", "restart", "getLogs"]),
            commandToRun: z.string().optional(),
            serverName: z.string(),
            lines: z.number().optional()
        })
    },
    reflectionTool
]

export const writeToFileTool = {
    name: "write_to_file",
    schema: {
        name: "write_to_file",
        schema: z.object({
            path: z.string(),
            content: z.string()
        })
    }
}