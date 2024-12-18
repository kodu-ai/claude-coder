import { z } from "zod"
import { Tool } from "."

const schema = z.object({
    options: z.object({
        agentName: z.string().describe("Name of the sub-agent for identification"),
        agentPrompt: z.string().describe("Custom prompt/instructions for this sub-agent"),
        allowedTools: z.array(z.enum([
            "add_interested_file",
            "ask_followup_question",
            "attempt_completion",
            "server_runner",
            "execute_command",
            "explore_repo_folder",
            "list_files",
            "read_file",
            "search_files",
            "search_symbol",
            "url_screenshot",
            "file_editor"
        ] as const)).optional().describe("List of tools this sub-agent has access to"),
        initialMemory: z.string().optional().describe("Optional memory/context to initialize the sub-agent with")
    })
})

const examples = [""]

export const subAgentTool = {
    schema: {
        name: "sub_agent" as const,
        schema,
    },
    examples,
}

export type SubAgentToolParams = {
    name: typeof subAgentTool.schema.name
    input: z.infer<typeof schema>
}

export type SubAgentOptions = z.infer<typeof schema>

export interface SubAgentState {
    /**
     * Parent agent's task ID
     */
    parentTaskId: string
    
    /**
     * Sub-agent specific memory/context
     */
    agentMemory?: string
    
    /**
     * Tools this agent has access to
     */
    allowedTools: Tool["schema"]["name"][]
}