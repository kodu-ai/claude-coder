import { z } from "zod"

const schema = z.object({
	result: z.string().describe("The result of the sub-agent operation"),
})

const examples = [""]

export const exitAgentTool = {
	schema: {
		name: "exit_agent" as const,
		schema,
	},
	examples,
}

export type ExitAgentToolParams = {
	name: typeof exitAgentTool.schema.name
	input: z.infer<typeof schema>
}
