import { z } from "zod"

export const SpawnAgentOptions = ["coder", "planner", "sub_task"] as const
export type SpawnAgentOptions = (typeof SpawnAgentOptions)[number]
const schema = z.object({
	agentName: z.enum(SpawnAgentOptions).describe("Name of the sub-agent for identification"),
	instructions: z.string().describe("Instructions for the sub-agent"),
	files: z.string().optional().describe("Files to be processed by the sub-agent"),
})

const examples = [""]

export const spawnAgentTool = {
	schema: {
		name: "spawn_agent" as const,
		schema,
	},
	examples,
}

export type SpawnAgentToolParams = {
	name: typeof spawnAgentTool.schema.name
	input: z.infer<typeof schema>
}
