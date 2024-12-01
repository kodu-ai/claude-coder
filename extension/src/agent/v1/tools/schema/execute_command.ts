// schema/execute_command.ts
import { z } from "zod"

export const COMMAND_TYPE = [
	"execute_blocking_command",
	"terminate_blocking_command",
	"resume_blocking_command",
] as const
/**
 * @tool execute_command
 * @description Execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will be executed in the current working directory.
 * @schema
 * {
 *   command: string; // The CLI command to execute.
 * }
 * @example
 * ```xml
 * <tool name="execute_command">
 *   <command>ls -la</command>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="execute_command">
 *   <command>mkdir new_folder && cd new_folder</command>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="execute_command">
 *   <command>echo 'Hello World' > hello.txt</command>
 * </tool>
 * ```
 */
const schema = z.object({
	id: z.string().optional().describe("The ID of the command to resume or terminate."),
	type: z
		.enum(COMMAND_TYPE)
		.describe(
			"The type of command to execute (execute_blocking_command, terminate_blocking_command, resume_blocking_command)."
		),
	command: z.string().optional().describe("The CLI command to execute."),
	stdin: z.string().optional().describe("The standard input to provide to the command."),
	timeout: z.number().optional().describe("The maximum time in milliseconds the command is allowed to run."),
	softTimeout: z
		.number()
		.optional()
		.describe("The time in milliseconds to wait before sending a termination signal."),
	outputMaxLines: z
		.number()
		.default(1000)
		.optional()
		.describe("The maximum number of lines to return in the output. default: 1,000"),
	outputMaxTokens: z
		.number()
		.default(10_000)
		.optional()
		.describe("The maximum number of tokens to return in the output. default: 10,000"),
})

const examples = [
	`<tool name="execute_command">
  <command>ls -la</command>
</tool>`,

	`<tool name="execute_command">
  <command>mkdir new_folder && cd new_folder</command>
</tool>`,

	`<tool name="execute_command">
  <command>echo 'Hello World' > hello.txt</command>
</tool>`,
]

export type ExecuteCommandToolParams = z.infer<typeof schema>

export const executeCommandTool = {
	schema: {
		name: "execute_command",
		schema,
	},
	examples,
}
