// schema/file-change-plan.ts
import { z } from "zod"

const schema = z.object({
	path: z.string().describe("The path of the file you want to change."),
	what_to_accomplish: z.string().describe("What you want to accomplish with this file change."),
})

const examples = [
	`<tool name="file-change-plan">
  <path>/src</path>
</tool>`,

	`<tool name="file-change-plan">
  <path>/lib</path>
</tool>`,

	`<tool name="file-change-plan">
  <path>/components</path>
</tool>`,
]

export const fileChangePlanTool = {
	schema: {
		name: "file_changes_plan",
		schema,
	},
	examples,
}

export type FileChangePlanParams = {
	name: "file_changes_plan"
	input: z.infer<typeof schema>
}
