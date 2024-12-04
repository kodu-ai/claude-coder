// schema/ask_consultant.ts
import { z } from "zod"

/**
 * @tool ask_consultant
 * @description Allows you to talk to an expert software consultant for help or direction when you're unable to solve a bug or need assistance.
 * @schema
 * {
 *   query: string; // The question or issue you want to ask the consultant.
 * }
 * @example
 * ```xml
 * <tool name="ask_consultant">
 *   <query>I'm encountering a segmentation fault when running my C++ application. How can I debug this?</query>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="ask_consultant">
 *   <query>What are the best practices for implementing authentication in a Node.js API?</query>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="ask_consultant">
 *   <query>How can I optimize the performance of my SQL queries in PostgreSQL?</query>
 * </tool>
 * ```
 */
const schema = z.object({
	query: z.string().describe("The question or issue you want to ask the consultant."),
})

const examples = [
	`<tool name="ask_consultant">
  <query>I'm encountering a segmentation fault when running my C++ application. How can I debug this?</query>
</tool>`,

	`<tool name="ask_consultant">
  <query>What are the best practices for implementing authentication in a Node.js API?</query>
</tool>`,

	`<tool name="ask_consultant">
  <query>How can I optimize the performance of my SQL queries in PostgreSQL?</query>
</tool>`,
]

export type AskConsultantParams = z.infer<typeof schema>

export const askConsultantTool = {
	schema: {
		name: "ask_consultant",
		schema,
	},
	examples,
}
