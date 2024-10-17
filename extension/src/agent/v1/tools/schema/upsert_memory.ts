// schema/upsert_memory.ts
import { z } from "zod"

/**
 * @tool upsert_memory
 * @description Allows you to create or update the task history with a summary of changes and the complete content of the task history in markdown. The tasks history tracks your progress and changes made to the task over time. It should also include notes and memories for future reference that you can refer back to when needed.
 * @schema
 * {
 *   summary: string;         // The summary of changes made.
 *   content: string;         // The complete content of the updated task history.
 *   milestoneName?: string;  // Optional name of the milestone achieved.
 * }
 * @example
 * ```xml
 * <tool name="upsert_memory">
 *   <summary>Implemented user authentication feature.</summary>
 *   <content># Task History\n- Implemented user authentication feature using JWT tokens.</content>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="upsert_memory">
 *   <summary>Fixed critical bug in data processing module.</summary>
 *   <content># Task History\n- Fixed null reference exception in data processing module.</content>
 *   <milestoneName>Bug Fix Release 1.0.1</milestoneName>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="upsert_memory">
 *   <summary>Completed initial project setup.</summary>
 *   <content># Task History\n- Set up project structure and initialized repository.</content>
 * </tool>
 * ```
 */
const schema = z.object({
	summary: z.string().describe("The summary of changes made in each update to the task history."),
	content: z.string().describe("The complete content of the updated task history to be written in markdown."),
	milestoneName: z.string().optional().describe("The name of the milestone achieved, around 30 characters."),
})

const examples = [
	`<tool name="upsert_memory">
  <summary>Implemented user authentication feature.</summary>
  <content># Task History\n- Implemented user authentication feature using JWT tokens.</content>
</tool>`,

	`<tool name="upsert_memory">
  <summary>Fixed critical bug in data processing module.</summary>
  <content># Task History\n- Fixed null reference exception in data processing module.</content>
  <milestoneName>Bug Fix Release 1.0.1</milestoneName>
</tool>`,

	`<tool name="upsert_memory">
  <summary>Completed initial project setup.</summary>
  <content># Task History\n- Set up project structure and initialized repository.</content>
</tool>`,
]

export const upsertMemoryTool = {
	schema: {
		name: "upsert_memory",
		schema,
	},
	examples,
}
