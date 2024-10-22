// schema/execute_command.ts
import { z } from 'zod'

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
	command: z
		.string()
		.describe(
			'The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.',
		),
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

export const executeCommandTool = {
	schema: {
		name: 'execute_command',
		schema,
	},
	examples,
}
