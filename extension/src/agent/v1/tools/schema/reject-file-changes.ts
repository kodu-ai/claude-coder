// schema/reject-file-changes.ts
import { z } from "zod"

const schema = z.object({
	reason: z.string().describe("The reason for rejecting the file changes."),
})

const examples = [
	`<tool name="reject_file_changes">
  <path>/src</path>
</tool>`,

	`<tool name="reject_file_changes">
  <path>/lib</path>
</tool>`,

	`<tool name="reject_file_changes">
  <path>/components</path>
</tool>`,
]

export const rejectFileChangesTool = {
	schema: {
		name: "reject_file_changes",
		schema,
	},
	examples,
}
